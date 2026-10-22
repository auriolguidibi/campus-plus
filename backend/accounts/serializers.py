from django.conf import settings
from django.contrib.auth import authenticate, password_validation
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Own profile. `verification` and identity fields are read-only so users cannot self-promote."""

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'school',
                  'field_of_study', 'promotion', 'bio', 'theme', 'verification']
        read_only_fields = ['id', 'email', 'verification']


class PublicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'field_of_study', 'promotion', 'verification']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    invite_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'password', 'school',
                  'field_of_study', 'promotion', 'invite_code']
        extra_kwargs = {f: {'required': True, 'allow_blank': False}
                        for f in ['first_name', 'last_name', 'school', 'field_of_study', 'promotion']}

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Cette adresse e-mail est déjà utilisée.')
        return value

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Ce pseudo est déjà pris.')
        return value

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def create(self, data):
        code = data.pop('invite_code', '')
        mode = settings.CAMPUS_VERIFICATION_MODE
        verified = mode == 'open' or (mode == 'invite' and code in settings.CAMPUS_INVITE_CODES)
        user = User(**{k: v for k, v in data.items() if k != 'password'})
        user.set_password(data['password'])
        user.verification = User.Verification.VERIFIED if verified else User.Verification.PENDING
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    login = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        ident = attrs['login'].strip()
        user = User.objects.filter(email__iexact=ident).first() or User.objects.filter(username__iexact=ident).first()
        user = authenticate(username=user.username, password=attrs['password']) if user else None
        if not user:
            raise serializers.ValidationError('Identifiants incorrects.')
        if not user.is_active:
            raise serializers.ValidationError('Ce compte est suspendu.')
        attrs['user'] = user
        return attrs
