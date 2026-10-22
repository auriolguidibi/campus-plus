from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .images import process_cropped
from .models import User
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterThrottle(AnonRateThrottle):
    scope = 'register'


class ResetThrottle(AnonRateThrottle):
    scope = 'reset'


def auth_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {'token': token.key, 'user': UserSerializer(user).data}


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(auth_payload(ser.save()), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginThrottle]

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(auth_payload(ser.validated_data['user']))


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        ser = UserSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        # Profile photo (square 512) and cover (3:1, 1500 px): validated, cropped and recompressed server-side.
        for field, size in (('avatar', (512, 512)), ('cover', (1500, 500))):
            f = request.FILES.get(field)
            if f:
                getattr(user, field).delete(save=False)
                setattr(user, field, process_cropped(f, size, f'{field}.jpg'))
            elif str(request.data.get(f'remove_{field}', '')).lower() in ('1', 'true'):
                getattr(user, field).delete(save=False)
                setattr(user, field, '')
        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request):
        # Re-authentication required; the account is anonymised (history of sales/messages must stay consistent).
        if not request.user.check_password(str(request.data.get('password', ''))):
            return Response({'password': 'Mot de passe incorrect.'}, status=400)
        request.user.anonymize()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ForgotPasswordView(APIView):
    """Always answers 200 so the endpoint cannot be used to discover registered e-mails."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ResetThrottle]

    def post(self, request):
        user = User.objects.filter(email__iexact=request.data.get('email', '')).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            send_mail('EIG Vibes — réinitialisation du mot de passe',
                      f'Code : {uid}.{token}', None, [user.email])
        return Response({'detail': 'Si ce compte existe, un e-mail a été envoyé.'})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ResetThrottle]

    def post(self, request):
        try:
            uid, token = str(request.data.get('code', '')).split('.', 1)
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
        except (ValueError, User.DoesNotExist):
            user = None
        if not user or not default_token_generator.check_token(user, token):
            return Response({'detail': 'Code invalide ou expiré.'}, status=400)
        password = request.data.get('password', '')
        password_validation.validate_password(password, user)
        user.set_password(password)
        user.save()
        Token.objects.filter(user=user).delete()
        return Response({'detail': 'Mot de passe modifié.'})
