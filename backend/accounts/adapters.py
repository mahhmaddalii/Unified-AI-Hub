from allauth.socialaccount.adapter import DefaultSocialAccountAdapter


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_auto_signup_allowed(self, request, sociallogin):
        return True

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)

        extra = getattr(sociallogin.account, "extra_data", {}) or {}
        if not user.first_name and extra.get("given_name"):
            user.first_name = extra.get("given_name")
        if not user.last_name and extra.get("family_name"):
            user.last_name = extra.get("family_name")

        return user
