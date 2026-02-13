# Tag: core
# Path: backend/app/parsers/base.py

from abc import ABC, abstractmethod

from app.models.schemas import FlightLegCSV, Pairing


class BaseICSParser(ABC):
    """ICS 파서 추상 클래스"""

    @staticmethod
    @abstractmethod
    def can_parse(file_content: bytes) -> bool:
        """이 파서가 해당 ICS 파일을 파싱할 수 있는지 판별"""
        ...

    @staticmethod
    @abstractmethod
    def parse(file_content: bytes) -> list[Pairing]:
        """ICS 파일을 파싱하여 Pairing 리스트 반환"""
        ...


class BaseCSVParser(ABC):
    """CSV 파서 추상 클래스"""

    @staticmethod
    @abstractmethod
    def can_parse(file_content: bytes) -> bool:
        """이 파서가 해당 CSV 파일을 파싱할 수 있는지 판별"""
        ...

    @staticmethod
    @abstractmethod
    def parse(file_content: bytes) -> list[FlightLegCSV]:
        """CSV 파일을 파싱하여 FlightLegCSV 리스트 반환"""
        ...
