# The Batch Processing Pipeline

Welcome to Track B. This folder contains a powerful Python engine designed to scrub, sort, and triage thousands of raw files for pennies using the OpenAI Batch API.

You need to run this entire phase **before** you ask an AI agent to build your wiki.

### 1. Requirements

- **Python 3.9+** installed on your computer.
- An **OpenAI API Key** with access to the Batch API (and some loaded credits).

### 2. Drop In Your Export

1. Unzip your ChatGPT export (or whatever provider you use).
2. Inside this exact folder alongside `batch_pipeline.py`, create a new folder called `raw`.
3. Drop all of your `.json` or `.html` conversation files into that `raw/` folder.

### 3. Execution

Open your terminal. `cd` into this folder, and run these commands one at a time:

```bash
# Export your API key so the script can use it securely
export OPENAI_API_KEY="your-sk-api-key-here"

# 1. Convert the messy raw HTML/JSON into clean, standardized records
python batch_pipeline.py normalize

# 2. Chop those records into exactly-sized logic batches
python batch_pipeline.py plan

# 3. Fire off the first pilot batch quietly to test your connection
python batch_pipeline.py submit-pilot

# 4. Wait a bit, then pull down the results to make sure it worked
python batch_pipeline.py sync-batch --batch-id=LYB001

# 5. If it looks good, fire off the rest of the waves broadly
python batch_pipeline.py submit-wave

# 6. Wait (this can take hours on OpenAI's side). Once all batches are "completed", sync them down.
python batch_pipeline.py sync-all

# 7. Merge the hundreds of split batch responses into one clean master list
python batch_pipeline.py merge
```

### 4. The Handoff

Once you run `merge`, this script is totally done. It will have created a folder called `triage/` containing a `master_list.md`.

**Now you start Phase 2:**
1. Leave this folder.
2. Go open your `brain_course_builder_kit.zip`.
3. Ask Claude Code or Codex to read your new `triage/master_list.md` to start rendering out the beautifully formatted system wiki pages!
