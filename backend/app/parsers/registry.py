# Tag: core
# Path: backend/app/parsers/registry.py

from app.models.schemas import FlightLegCSV, Pairing
from app.parsers.airlines.skywest import SkyWestICSParser
from app.parsers.airlines.skywest_csv import SkyWestCSVParser

# 파서 등록 순서 = 감지 우선순위
ICS_PARSERS = [SkyWestICSParser]
CSV_PARSERS = [SkyWestCSVParser]


def parse_ics(file_content: bytes) -> list[Pairing]:
    """등록된 ICS 파서 중 can_parse() == True인 첫 번째 파서로 파싱"""
    for parser_cls in ICS_PARSERS:
        if parser_cls.can_parse(file_content):
            return parser_cls.parse(file_content)
    raise ValueError("지원되지 않는 ICS 파일 포맷입니다")


def parse_csv(file_content: bytes) -> list[FlightLegCSV]:
    """등록된 CSV 파서 중 can_parse() == True인 첫 번째 파서로 파싱"""
    for parser_cls in CSV_PARSERS:
        if parser_cls.can_parse(file_content):
            return parser_cls.parse(file_content)
    raise ValueError("지원되지 않는 CSV 파일 포맷입니다")
