import pymongo
import gridfs
from pymongo import MongoClient
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import logging
from bson import ObjectId

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        # Get MongoDB connection string from environment variable or use default
        self.connection_string = os.getenv("MONGODB_CONNECTION_STRING", "mongodb://localhost:27017/")
        self.database_name = os.getenv("MONGODB_DATABASE_NAME", "meeting_transcriber")
        
        try:
            # Create MongoDB client
            self.client = MongoClient(self.connection_string)
            self.db = self.client[self.database_name]
            self.meetings_collection = self.db.meetings
            self.fs = gridfs.GridFS(self.db)
            
            # Create indexes for better query performance
            self.meetings_collection.create_index("meeting_id", unique=True)
            self.meetings_collection.create_index("created_at")
            
            logger.info("Connected to MongoDB successfully")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    def save_meeting(self, meeting_data: Dict[str, Any]) -> str:
        """
        Save meeting data to MongoDB
        :param meeting_data: Dictionary containing meeting information
        :return: The meeting ID
        """
        try:
            # Add timestamp if not present
            if "created_at" not in meeting_data:
                meeting_data["created_at"] = datetime.now(timezone.utc)
            
            # Insert meeting data into collection
            result = self.meetings_collection.insert_one(meeting_data)
            logger.info(f"Meeting saved with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save meeting: {e}")
            raise

    def get_meeting(self, meeting_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve meeting data from MongoDB
        :param meeting_id: The meeting ID
        :return: Meeting data or None if not found
        """
        try:
            meeting = self.meetings_collection.find_one({"meeting_id": meeting_id})
            if meeting:
                # Convert ObjectId to string for JSON serialization
                meeting["_id"] = str(meeting["_id"])
            return meeting
        except Exception as e:
            logger.error(f"Failed to retrieve meeting: {e}")
            return None

    def get_all_meetings(self) -> list:
        """
        Retrieve all meetings from MongoDB
        :return: List of meetings
        """
        try:
            meetings = list(self.meetings_collection.find())
            # Convert ObjectId to string for JSON serialization
            for meeting in meetings:
                meeting["_id"] = str(meeting["_id"])
            return meetings
        except Exception as e:
            logger.error(f"Failed to retrieve meetings: {e}")
            return []

    def save_audio_file(self, audio_data: bytes, filename: str) -> str:
        """
        Save audio file to GridFS
        :param audio_data: Audio file data
        :param filename: Name of the file
        :return: File ID
        """
        try:
            file_id = self.fs.put(audio_data, filename=filename)
            logger.info(f"Audio file saved with ID: {file_id}")
            return str(file_id)
        except Exception as e:
            logger.error(f"Failed to save audio file: {e}")
            raise

    def get_audio_file(self, file_id: str) -> Optional[bytes]:
        """
        Retrieve audio file from GridFS
        :param file_id: File ID
        :return: Audio file data or None if not found
        """
        try:
            oid = ObjectId(file_id)
            file_data = self.fs.get(oid)
            return file_data.read()
        except Exception as e:
            logger.error(f"Failed to retrieve audio file: {e}")
            return None

    def close_connection(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

# Global database manager instance
db_manager = DatabaseManager()
