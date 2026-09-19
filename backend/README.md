# PatoPay API

FastAPI backend for PatoPay.

## Local setup

Run these commands from this `backend/` directory:

```bash
uv sync --all-groups
uv run uvicorn patopay.main:app --reload
```

The API is available at `http://127.0.0.1:8000`, OpenAPI at `/docs`, and the
versioned endpoints under `/api/v1`.

## Quality gate

Run from `backend/`:

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```
