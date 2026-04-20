# Demo Guide — 60-Second Flow

## Pre-Demo Checklist

- [ ] Backend running: `cd backend && python main.py`
- [ ] Backend responds: open http://localhost:8000 in browser
- [ ] Frontend open: `frontend/index.html` in Chrome/Edge
- [ ] Browser dev tools closed (cleaner presentation)
- [ ] Screen resolution 1920x1080 or higher

## Demo Script (60 Seconds)

### Opening (10 seconds)
> "In every Oracle ERP project, when someone modifies a table like EMPLOYEES, nobody knows what OIC flows, BIP reports, or Groovy scripts will break. We built a tool that maps every cross-artifact dependency instantly."

### Step 1 — Load Demo (5 seconds)
1. Click **"🎭 Load Demo"** button
2. Graph renders with 18+ nodes and colored edges
> "We upload Oracle artifacts — SQL, OIC XML, BIP reports, Groovy scripts — and our parsers extract every object and dependency."

### Step 2 — Show the Graph (10 seconds)
1. Hover over a few nodes to show tooltips
2. Point out different colors = different artifact types
> "This is a live dependency graph. Tables are blue, views are cyan, procedures are green, OIC flows are orange, BIP reports are pink."

### Step 3 — Compute Impact (10 seconds)
1. Select **EMPLOYEES** from the dropdown
2. Click **"💥 Compute Impact"**
3. Graph lights up red — impacted nodes highlighted
> "Now watch — I select the EMPLOYEES table and compute impact. Every object that would break lights up red."

### Step 4 — Impact Analysis Tab (10 seconds)
1. Switch to **Impact Analysis** tab
2. Point out: CRITICAL severity, score 82/100
3. Show direct impacts (5+) and indirect impacts (2+)
> "CRITICAL severity, risk score 82 out of 100. Five directly impacted objects, two indirectly impacted through transitive dependencies."

### Step 5 — AI Analysis Tab (10 seconds)
1. Switch to **AI Analysis** tab
2. Scroll through root cause, recommendations, testing checklist, rollback
> "OCI Generative AI gives us root cause analysis, five specific fix steps, a testing checklist, and a complete rollback plan. All generated in seconds."

### Closing (5 seconds)
> "What used to take days of manual dependency tracing now takes 60 seconds. This is Impact Analysis Generator."

## Fallback Plans

**If backend is down:**
- The frontend shows "Backend not reachable" — restart with `python main.py`

**If graph doesn't render:**
- Check browser console for errors
- Refresh the page and click Load Demo again

**If EMPLOYEES shows wrong score:**
- This means sample artifacts were modified — restore from git
- Score must be 82, severity must be CRITICAL

**If AI Analysis is empty:**
- Mock mode should always return results
- Check that `ai/oci_genai.py` is not erroring — check backend terminal output
