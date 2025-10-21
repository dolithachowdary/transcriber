import sqlite3
import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

class LocalDatabaseManager:
    def __init__(self):
        # Create database in user's AppData folder for privacy
        self.app_data_dir = os.path.join(os.getenv('APPDATA'), 'MeetingTranscriber')
        os.makedirs(self.app_data_dir, exist_ok=True)
        
        self.db_path = os.path.join(self.app_data_dir, 'meetings.db')
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database with required tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create meetings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS meetings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT UNIQUE NOT NULL,
                meeting_name TEXT NOT NULL,
                transcript TEXT NOT NULL,
                summary TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                audio_file_path TEXT,
                user_id TEXT DEFAULT 'default_user'
            )
        ''')
        
        # Create audio_files table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audio_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def save_meeting(self, meeting_data: Dict[str, Any]) -> str:
        """Save meeting data to local SQLite database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        meeting_id = meeting_data.get('meeting_id', f"meeting_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        
        cursor.execute('''
            INSERT OR REPLACE INTO meetings 
            (meeting_id, meeting_name, transcript, summary, audio_file_path)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            meeting_id,
            meeting_data.get('meeting_name', 'Untitled Meeting'),
            json.dumps(meeting_data.get('transcript', [])),
            meeting_data.get('summary', ''),
            meeting_data.get('audio_file_path', '')
        ))
        
        conn.commit()
        conn.close()
        return meeting_id
    
    def get_all_meetings(self) -> List[Dict[str, Any]]:
        """Get all meetings for the current user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT meeting_id, meeting_name, transcript, summary, created_at, audio_file_path
            FROM meetings
            ORDER BY created_at DESC
        ''')
        
        meetings = []
        for row in cursor.fetchall():
            meetings.append({
                'meeting_id': row[0],
                'meeting_name': row[1],
                'transcript': json.loads(row[2]),
                'summary': row[3],
                'created_at': row[4],
                'audio_file_path': row[5]
            })
        
        conn.close()
        return meetings
    
    def get_meeting(self, meeting_id: str) -> Optional[Dict[str, Any]]:
        """Get specific meeting details"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT meeting_id, meeting_name, transcript, summary, created_at, audio_file_path
            FROM meetings
            WHERE meeting_id = ?
        ''', (meeting_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'meeting_id': row[0],
                'meeting_name': row[1],
                'transcript': json.loads(row[2]),
                'summary': row[3],
                'created_at': row[4],
                'audio_file_path': row[5]
            }
        return None
    
    def save_audio_file(self, meeting_id: str, file_path: str, file_name: str) -> int:
        """Save audio file reference to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO audio_files (meeting_id, file_path, file_name, file_size)
            VALUES (?, ?, ?, ?)
        ''', (meeting_id, file_path, file_name, os.path.getsize(file_path) if os.path.exists(file_path) else 0))
        
        file_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return file_id
    
    def get_audio_file(self, meeting_id: str) -> Optional[str]:
        """Get audio file path for a meeting"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT file_path FROM audio_files
            WHERE meeting_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        ''', (meeting_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        return row[0] if row else None
    
    def delete_meeting(self, meeting_id: str) -> bool:
        """Delete meeting and associated audio files"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Delete audio files first
        cursor.execute('DELETE FROM audio_files WHERE meeting_id = ?', (meeting_id,))
        
        # Delete meeting
        cursor.execute('DELETE FROM meetings WHERE meeting_id = ?', (meeting_id,))
        
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        return deleted

# Global instance
local_db = LocalDatabaseManager()
