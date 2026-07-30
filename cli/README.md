# Ghost-PM CLI

Headless CLI project manager designed specifically for 24-hour hackathons.

## Features
- Connects to Supabase rooms
- Enforces scope on `git commit` via pre-commit hooks
- Tracks time spent in files via background daemon
- Automatically generates codebase graphs using Graphify
- Syncs state dynamically without a heavy local UI

## Installation

```bash
pip install -e .
```

## Usage

```bash
ghost connect <room-id>
ghost status
ghost daemon start
```
