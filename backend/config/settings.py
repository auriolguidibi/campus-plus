"""EIG Vibes settings. Secrets and DB come from environment variables (see .env.example)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path):
    """Minimal .env loader (KEY=VALUE lines). Real environment variables always win."""
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv(BASE_DIR / '.env')

DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-only-insecure-key' if DEBUG else '')
if not SECRET_KEY:
    raise RuntimeError('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=0')
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'accounts',
    'communities',
    'social',
    'market',
    'chat',
    'stories',
    'campus',
    'moderation',
    'notifications',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'config.wsgi.application'

# SQLite by default; set DB_ENGINE=mysql (+ DB_NAME/USER/PASSWORD/HOST, pip install mysqlclient) for MySQL.
if os.environ.get('DB_ENGINE') == 'mysql':
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.environ['DB_NAME'], 'USER': os.environ['DB_USER'],
        'PASSWORD': os.environ['DB_PASSWORD'], 'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '3306'),
        'OPTIONS': {'charset': 'utf8mb4'},
    }}
else:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.environ.get('SQLITE_PATH', BASE_DIR / 'db.sqlite3')}}

AUTH_USER_MODEL = 'accounts.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fr'
TIME_ZONE = 'Africa/Porto-Novo'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
# Built React app (frontend/dist). When present, WhiteNoise serves it at the site root and Django falls back to
# index.html for client-side routes, so one process serves API + app.
FRONTEND_DIST = Path(os.environ.get('FRONTEND_DIST', BASE_DIR.parent / 'frontend' / 'dist'))
if (FRONTEND_DIST / 'index.html').exists():
    WHITENOISE_ROOT = FRONTEND_DIST
# Uploaded media: serve from Django only when no reverse proxy does it (SERVE_MEDIA=1, small deployments).
SERVE_MEDIA = DEBUG or os.environ.get('SERVE_MEDIA', '0') == '1'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', '1') == '1'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'EIG Vibes <no-reply@eigvibes.local>')

LOGGING = {
    'version': 1, 'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': os.environ.get('LOG_LEVEL', 'INFO')},
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.TokenAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle', 'rest_framework.throttling.UserRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {'anon': '60/min', 'user': '300/min', 'login': '5/min', 'register': '10/hour',
                               'reset': '5/hour', 'report': '30/hour', 'call_signal': '1200/min'},
}

# Campus verification: 'invite' (code), 'admin' (manual validation) or 'open'. Not tied to e-mail domains.
CAMPUS_VERIFICATION_MODE = os.environ.get('CAMPUS_VERIFICATION_MODE', 'invite')
CAMPUS_INVITE_CODES = [c for c in os.environ.get('CAMPUS_INVITE_CODES', 'CAMPUS2026').split(',') if c]

# Marketplace: when True, new listings wait in 'pending' until a moderator publishes them.
MARKET_REQUIRE_MODERATION = os.environ.get('MARKET_REQUIRE_MODERATION', '0') == '1'
MARKET_FORBIDDEN_TERMS = ['arme à feu', 'drogue', 'cocaïne', 'cannabis', 'munition', 'faux billet', 'faux diplôme']

# Stories expire after this many hours (run `manage.py purge_stories` periodically to delete expired files).
STORY_DURATION_HOURS = int(os.environ.get('STORY_DURATION_HOURS', '24'))
# Confessions wait for moderator approval before appearing publicly.
CONFESSIONS_PREMODERATION = os.environ.get('CONFESSIONS_PREMODERATION', '1') == '1'

# --- Calls (WebRTC) ---
# Media is peer-to-peer. STUN is enough for most networks; behind strict NAT/4G a TURN relay is needed (set CALL_TURN_*).
CALL_STUN_URLS = os.environ.get('CALL_STUN_URLS', 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302').split(',')
CALL_TURN_URL = os.environ.get('CALL_TURN_URL', '')
CALL_TURN_USERNAME = os.environ.get('CALL_TURN_USERNAME', '')
CALL_TURN_CREDENTIAL = os.environ.get('CALL_TURN_CREDENTIAL', '')

# --- Security hardening ---
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024    # non-file request bodies
FILE_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'same-origin'
if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SSL_REDIRECT', '1') == '1'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# Tests only: a fast hasher keeps the suite quick. Never active outside `manage.py test`.
import sys  # noqa: E402
if 'test' in sys.argv:
    PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
    # ...and a fast suite shares one throttle cache across tests, so limits are lifted here; config/test_security.py
    # re-enables a low limit explicitly to prove throttling works.
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {k: '100000/min' for k in REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']}
