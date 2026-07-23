from __future__ import annotations
import uuid
from threading import Lock
from models.dataset import Dataset, parse_file


class FileStorage:
    """Thread-safe in-memory dataset store keyed by UUID."""

    def __init__(self):
        self._store: dict[str, Dataset] = {}
        self._lock = Lock()

    def save_file(self, file_name: str, content: bytes) -> tuple[str, Dataset]:
        dataset = parse_file(file_name, content)
        file_id = str(uuid.uuid4())
        with self._lock:
            self._store[file_id] = dataset
        return file_id, dataset

    def get_dataset(self, file_id: str) -> Dataset | None:
        with self._lock:
            return self._store.get(file_id)

    def delete(self, file_id: str) -> None:
        with self._lock:
            self._store.pop(file_id, None)


# Singleton instance shared across the app
file_storage = FileStorage()
