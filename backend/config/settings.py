"""Campus+ settings. Secrets and DB come from environment variables (see .env.example)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-only-insecure-key' if DEBUG else '')
if not SECRET_KEY:
    raise RuntimeError('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=0')
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

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
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
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
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}

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

STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.TokenAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_THROTTLE_RATES': {'login': '5/min', 'register': '10/hour', 'reset': '5/hour'},
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
