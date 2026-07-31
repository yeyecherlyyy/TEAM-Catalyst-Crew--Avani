import os, sys
sys.path.insert(0, './cli')
from ghost_pm.config import GhostConfig
from supabase import create_client

config = GhostConfig.load()
client = create_client(config.supabase_url, config.supabase_key)

print(f"Has access token: {bool(config.access_token)}")

# Try to set session
try:
    client.auth.set_session(config.access_token, config.refresh_token)
    print("set_session worked.")
except Exception as e:
    print(f"set_session failed: {e}")

# Try to explicitly set postgrest header
client.postgrest.auth(config.access_token)

# Try RPC
try:
    res = client.rpc("join_team_by_code", {"p_team_code": "YE3GMR"}).execute()
    print(f"RPC result: {res}")
except Exception as e:
    print(f"RPC failed: {e}")
