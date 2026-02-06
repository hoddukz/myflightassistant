# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/routers/schedule.py

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.schemas import FlightLegCSV, Pairing, ScheduleResponse
from app.parsers.csv_parser import parse_csv
from app.parsers.ics_parser import parse_ics

router = APIRouter()


@router.post("/upload/ics", response_model=ScheduleResponse)
async def upload_ics(file: UploadFile = File(...)):
    """iCal(.ics) 파일을 업로드하여 파싱한다."""
    if not file.filename or not file.filename.endswith(".ics"):
        raise HTTPException(status_code=400, detail="Only .ics files are supported")

    content = await file.read()
    try:
        pairings = parse_ics(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse ICS file: {e}")

    total_flights = sum(
        len(leg)
        for p in pairings
        for d in p.days
        for leg in [d.legs]
    )

    return ScheduleResponse(
        pairings=pairings,
        total_flights=total_flights,
    )


@router.post("/upload/csv", response_model=list[FlightLegCSV])
async def upload_csv(file: UploadFile = File(...)):
    """CSV 파일을 업로드하여 파싱한다."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    try:
        legs = parse_csv(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse CSV file: {e}")

    return legs
