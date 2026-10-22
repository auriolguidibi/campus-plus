from django.conf import settings
from django.db import connection
from django.http import FileResponse, Http404, JsonResponse


def health(request):
    """Public liveness/readiness probe: checks the database, exposes nothing else."""
    try:
        with connection.cursor() as c:
            c.execute('SELECT 1')
    except Exception:
        return JsonResponse({'status': 'error'}, status=503)
    return JsonResponse({'status': 'ok'})


def spa_index(request, path=''):
    """Client-side routes (e.g. /marketplace/3) return the React app shell."""
    index = settings.FRONTEND_DIST / 'index.html'
    if not index.exists():
        raise Http404('Frontend not built (run `npm run build` in frontend/).')
    return FileResponse(open(index, 'rb'), content_type='text/html; charset=utf-8')
