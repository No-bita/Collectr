#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import tempfile
import zipfile
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List

from sarvamai import SarvamAI
from sarvamai.core.api_error import ApiError


DEFAULT_LANGUAGE = os.environ.get("SARVAM_DOC_LANGUAGE", "en-IN")
DEFAULT_OUTPUT_FORMAT = os.environ.get("SARVAM_DOC_OUTPUT_FORMAT", "md")
POLL_INTERVAL_SECONDS = float(os.environ.get("SARVAM_POLL_INTERVAL_SECONDS", "2"))
POLL_TIMEOUT_SECONDS = float(os.environ.get("SARVAM_POLL_TIMEOUT_SECONDS", "120"))
ALLOWED_INPUT_EXTENSIONS = {".pdf", ".zip", ".png", ".jpg", ".jpeg"}
ALLOWED_OUTPUT_FORMATS = {"md", "html"}


def fail(message: str) -> None:
    sys.stderr.write(message + "\n")
    sys.exit(1)


def normalize_output_format(output_format: str) -> str:
    value = (output_format or "").strip().lower()
    if value not in ALLOWED_OUTPUT_FORMATS:
        fail(
            f"Unsupported SARVAM_DOC_OUTPUT_FORMAT='{output_format}'. "
            "Allowed values: html, md."
        )
    return value


def extract_job_state(status: Any) -> str:
    if isinstance(status, dict):
        return str(status.get("job_state", "")).strip()
    return str(getattr(status, "job_state", "")).strip()


def wait_for_completion(job: Any) -> None:
    start = time.time()
    while True:
        try:
            status = job.get_status()
        except AttributeError:
            # Fallback for SDK versions that only expose wait_until_complete().
            status = job.wait_until_complete()
            state = extract_job_state(status)
            if state in {"Completed", "PartiallyCompleted"}:
                return
            fail(f"Sarvam OCR job did not complete successfully (state: {state or 'unknown'}).")
        except ApiError as exc:
            fail(f"Sarvam SDK get_status failed ({exc.status_code}): {exc.body}")
        except Exception as exc:
            fail(f"Sarvam SDK get_status failed: {exc}")

        state = extract_job_state(status)
        if state in {"Completed", "PartiallyCompleted"}:
            return
        if state == "Failed":
            fail("Sarvam OCR job failed (state: Failed).")
        if time.time() - start > POLL_TIMEOUT_SECONDS:
            fail(f"Sarvam OCR job timed out after {POLL_TIMEOUT_SECONDS}s (last state: {state})")
        time.sleep(POLL_INTERVAL_SECONDS)


def to_jsonable(value: Any) -> Any:
    if is_dataclass(value):
        return asdict(value)
    if hasattr(value, "model_dump") and callable(getattr(value, "model_dump")):
        return value.model_dump()
    if hasattr(value, "dict") and callable(getattr(value, "dict")):
        return value.dict()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if hasattr(value, "__dict__"):
        return {str(k): to_jsonable(v) for k, v in vars(value).items() if not str(k).startswith("_")}
    return str(value)


def parse_zip_to_raw_files(zip_blob: bytes) -> List[Dict[str, Any]]:
    files: List[Dict[str, Any]] = []
    with zipfile.ZipFile(BytesIO(zip_blob)) as zf:
        members = sorted([m for m in zf.namelist() if not m.endswith("/")])
        for member in members:
            lower = member.lower()
            raw = zf.read(member)
            decoded_content: Any = None
            content_type = "binary"
            if lower.endswith(".md") or lower.endswith(".txt") or lower.endswith(".html"):
                decoded_content = raw.decode("utf-8", errors="replace")
                content_type = "text"
            elif lower.endswith(".json"):
                try:
                    decoded_content = json.loads(raw.decode("utf-8", errors="replace"))
                    content_type = "json"
                except Exception:
                    decoded_content = raw.decode("utf-8", errors="replace")
                    content_type = "text"
            files.append(
                {
                    "name": member,
                    "content_type": content_type,
                    "size_bytes": len(raw),
                    "content": to_jsonable(decoded_content),
                }
            )
    return files


def run_sarvam_ocr(file_path: str, api_key: str, language: str, output_format: str) -> Dict[str, Any]:
    client = SarvamAI(api_subscription_key=api_key)
    try:
        job = client.document_intelligence.create_job(language=language, output_format=output_format)
        job.upload_file(file_path)
        job.start()
        wait_for_completion(job)
        try:
            status = job.get_status()
        except AttributeError:
            status = job.wait_until_complete()
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp_zip:
            tmp_path = tmp_zip.name
        try:
            job.download_output(tmp_path)
            with open(tmp_path, "rb") as f:
                blob = f.read()
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
        if not blob:
            fail("Sarvam SDK returned empty OCR output.")
        job_status = to_jsonable(status)
        job_id = ""
        if isinstance(job_status, dict):
            job_id = str(job_status.get("job_id") or "").strip()
        if not job_id:
            job_id = str(getattr(job, "job_id", "")).strip()
        files = parse_zip_to_raw_files(blob)
        return {
            "job_id": job_id or None,
            "status": job_status,
            "output_files": files,
        }
    except ApiError as exc:
        fail(f"Sarvam SDK request failed ({exc.status_code}): {exc.body}")
    except FileNotFoundError:
        fail(f"File not found while uploading to Sarvam SDK: {file_path}")
    except Exception as exc:
        fail(f"Sarvam SDK OCR flow failed: {exc}")
    return b""


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Sarvam Document Intelligence OCR and emit raw provider output JSON.")
    parser.add_argument("--file", required=True, help="Path to image or PDF.")
    args = parser.parse_args()

    file_path = args.file
    if not os.path.exists(file_path):
        fail(f"File not found: {file_path}")

    api_key = os.environ.get("SARVAM_API_SUBSCRIPTION_KEY", "").strip()
    if not api_key:
        fail("SARVAM_API_SUBSCRIPTION_KEY is required.")

    file_ext = Path(file_path).suffix.lower()
    if file_ext not in ALLOWED_INPUT_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_INPUT_EXTENSIONS))
        fail(f"Unsupported file type '{file_ext or 'none'}'. Allowed extensions: {allowed}.")

    output_format = normalize_output_format(DEFAULT_OUTPUT_FORMAT)
    payload = run_sarvam_ocr(
        file_path=file_path,
        api_key=api_key,
        language=DEFAULT_LANGUAGE,
        output_format=output_format,
    )
    output_files = payload.get("output_files") if isinstance(payload, dict) else None
    if not isinstance(output_files, list) or not output_files:
        fail("Sarvam OCR produced no output files.")
    sys.stdout.write(json.dumps(payload, default=str))


if __name__ == "__main__":
    main()
