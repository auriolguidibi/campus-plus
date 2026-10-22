import io

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

from social.views import process_image


def process_cropped(f, size, name):
    """Validate like any upload (real image, <= 8 Mo), then crop-to-fill `size` (w, h) and recompress as JPEG."""
    checked = process_image(f)  # raises ValidationError for fake/oversized files
    img = ImageOps.fit(Image.open(io.BytesIO(checked.read())), size, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=84, optimize=True)
    return ContentFile(buf.getvalue(), name=name)
