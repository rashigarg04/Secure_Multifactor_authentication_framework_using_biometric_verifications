import os

# Set before the app is imported so Settings() finds the values.
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("TEMPLATE_ENCRYPTION_KEY", "test-key")