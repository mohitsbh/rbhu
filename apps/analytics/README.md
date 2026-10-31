# RBHU Sales Analytics Microservice (Module 3)

`POST /analyze` — accepts a multipart CSV upload with headers
`salesperson,revenue,region` and returns the assignment outputs:

- **Revenue by Region** (aggregated bar chart – Plotly figure spec)
- **Top Salespeople** (ranked bar chart – Plotly figure spec)
- **Summary statistics** (count, mean, median, min, max, std of revenue)

Bonus: `?format=png` re-renders both charts server-side with Kaleido and
returns them as base64 PNGs (graceful error if Kaleido is unavailable).

Run:

```bash
cd apps/analytics
python -m venv .venv
.venv\\Scripts\\pip install -r requirements.txt
.venv\\Scripts\\uvicorn main:app --port 8001
```

Interactive API docs: http://localhost:8001/docs
