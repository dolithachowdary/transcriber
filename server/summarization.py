# import nltk
# from sumy.parsers.plaintext import PlaintextParser
# from sumy.nlp.tokenizers import Tokenizer
# from sumy.summarizers.lex_rank import LexRankSummarizer
# from nltk.corpus import stopwords
# import logging

# logger = logging.getLogger(__name__)

# # Ensure nltk stopwords are downloaded
# try:
#     nltk.data.find('corpora/stopwords')
# except LookupError:
#     try:
#         nltk.download('stopwords', quiet=True)
#     except:
#         logger.warning("Could not download nltk stopwords")

# class OfflineSummarizer:
#     def __init__(self):
#         self.summarizer = LexRankSummarizer()
#         try:
#             self.stopwords = set(stopwords.words('english'))
#         except:
#             self.stopwords = set()
#             logger.error("Could not load stopwords, using empty set")
        
#         logger.info("Offline LexRank summarizer initialized")
        
#     def summarize(self, text, summary_length=5):
#         """Summarize text using LexRank algorithm"""
#         if not text.strip():
#             return "No content to summarize"
        
#         try:
#             # Create parser
#             parser = PlaintextParser.from_string(text, Tokenizer("english"))
            
#             # Summarize
#             summary_sentences = self.summarizer(parser.document, summary_length)
            
#             # Combine sentences
#             return " ".join(str(sentence) for sentence in summary_sentences)
#         except Exception as e:
#             logger.error(f"Summarization error: {e}")
#             return "Summary generation failed"

#     def summarize_chunks(self, text, max_chunk_size=1024, summary_length=5):
#         """Summarize long text by splitting into chunks"""
#         if not text.strip():
#             return "No content to summarize"
            
#         chunks = [text[i:i+max_chunk_size] for i in range(0, len(text), max_chunk_size)]
#         summaries = []
        
#         for chunk in chunks:
#             try:
#                 parser = PlaintextParser.from_string(chunk, Tokenizer("english"))
#                 summary = self.summarizer(parser.document, summary_length)
#                 summaries.append(" ".join(str(s) for s in summary))
#             except Exception as e:
#                 logger.error(f"Chunk summarization failed: {e}")
                
#         return " ".join(summaries)

import nltk
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lex_rank import LexRankSummarizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.summarizers.text_rank import TextRankSummarizer
from sumy.nlp.stemmers import Stemmer
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize
import re
import logging

logger = logging.getLogger(__name__)

# Ensure nltk resources are downloaded
try:
    nltk.data.find('corpora/stopwords')
    nltk.data.find('tokenizers/punkt')
except LookupError:
    try:
        nltk.download('stopwords', quiet=True)
        nltk.download('punkt', quiet=True)
    except Exception as e:
        logger.warning(f"Could not download nltk resources: {e}")

class OfflineSummarizer:
    def __init__(self):
        self.stemmer = Stemmer("english")
        self.summarizers = {
            'lsa': LsaSummarizer(self.stemmer),
            'text_rank': TextRankSummarizer(self.stemmer),
            'lex_rank': LexRankSummarizer(self.stemmer)
        }
        try:
            self.stopwords = set(stopwords.words('english'))
        except:
            self.stopwords = set()
            logger.error("Could not load stopwords, using empty set")
        
        # Configure summarizers
        for name, summarizer in self.summarizers.items():
            summarizer.stop_words = self.stopwords
        
        logger.info("Offline summarizer initialized with LSA, TextRank, and LexRank algorithms")
    
    def _clean_text(self, text):
        """Clean and preprocess text for better summarization"""
        # Remove excessive whitespace and newlines
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove special characters except basic punctuation
        text = re.sub(r'[^\w\s.,;:!?\'"-]', '', text)
        
        # Fix common punctuation issues
        text = re.sub(r'\s+([.,;:!?])', r'\1', text)
        text = re.sub(r'([.,;:!?])\s*', r'\1 ', text)
        
        return text

    def summarize(self, text, summary_ratio=0.2):
        """Summarize text using the best available algorithm"""
        if not text.strip():
            return "No content to summarize"
        
        # Clean text first
        text = self._clean_text(text)
        
        try:
            # Create parser
            parser = PlaintextParser.from_string(text, Tokenizer("english"))
            
            # Determine summary length based on text complexity
            sentences = sent_tokenize(text)
            num_sentences = len(sentences)
            
            # Adaptive summary length (min 3, max 10 sentences)
            summary_length = max(3, min(10, int(num_sentences * summary_ratio)))
            logger.info(f"Summarizing {num_sentences} sentences to {summary_length} sentences")
            
            # Try different algorithms in order of preference
            for algo in ['lsa', 'text_rank', 'lex_rank']:
                try:
                    summarizer = self.summarizers[algo]
                    summary_sentences = summarizer(parser.document, summary_length)
                    summary = " ".join(str(sentence) for sentence in summary_sentences)
                    
                    # Ensure summary ends with proper punctuation
                    if not re.search(r'[.!?]$', summary):
                        summary = summary.rstrip() + '.'
                        
                    logger.debug(f"{algo.upper()} summary: {summary[:200]}...")
                    return summary
                except Exception as e:
                    logger.warning(f"{algo.upper()} summarization failed: {e}")
            
            # Fallback to extractive method if all algorithms fail
            return self._fallback_summary(sentences, summary_length)
        except Exception as e:
            logger.error(f"Summarization error: {e}")
            return "Summary generation failed"

    def _fallback_summary(self, sentences, summary_length):
        """Fallback summarization using sentence scoring"""
        from collections import defaultdict
        # Simple scoring based on word frequency
        word_freq = defaultdict(int)
        for sentence in sentences:
            for word in sentence.lower().split():
                if word not in self.stopwords and word.isalpha():
                    word_freq[word] += 1
        
        # Score sentences
        scored_sentences = []
        for i, sentence in enumerate(sentences):
            score = sum(word_freq[word] for word in sentence.lower().split() 
                       if word in word_freq and word.isalpha())
            scored_sentences.append((i, sentence, score))
        
        # Select top sentences while preserving order
        scored_sentences.sort(key=lambda x: x[2], reverse=True)
        selected_indices = sorted([idx for idx, _, _ in scored_sentences[:summary_length]])
        summary = " ".join(sentences[i] for i in selected_indices)
        
        # Ensure proper punctuation
        if not re.search(r'[.!?]$', summary):
            summary = summary.rstrip() + '.'
            
        logger.info("Used fallback summarization method")
        return summary

    def summarize_chunks(self, text, max_chunk_size=5000, summary_ratio=0.2):
        """Summarize long text by splitting into coherent chunks"""
        if not text.strip():
            return "No content to summarize"
        
        # Clean text first
        text = self._clean_text(text)
        sentences = sent_tokenize(text)
        
        # Split into chunks without breaking sentences
        chunks = []
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence_length = len(sentence)
            if current_length + sentence_length <= max_chunk_size or not current_chunk:
                current_chunk.append(sentence)
                current_length += sentence_length
            else:
                chunks.append(" ".join(current_chunk))
                current_chunk = [sentence]
                current_length = sentence_length
        
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        logger.info(f"Split text into {len(chunks)} chunks for summarization")
        
        # Summarize each chunk
        chunk_summaries = []
        for chunk in chunks:
            try:
                summary = self.summarize(chunk, summary_ratio)
                chunk_summaries.append(summary)
            except Exception as e:
                logger.error(f"Chunk summarization failed: {e}")
                # Include first sentence as fallback
                first_sentence = sent_tokenize(chunk)[0] if sent_tokenize(chunk) else chunk[:100]
                chunk_summaries.append(first_sentence + "...")
        
        # Combine chunk summaries
        combined_summary = " ".join(chunk_summaries)
        
        # Final summarization pass
        return self.summarize(combined_summary, summary_ratio)