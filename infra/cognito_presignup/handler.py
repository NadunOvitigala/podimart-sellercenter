"""Cognito Pre Sign-up trigger — auto-confirm sellers (no email code)."""


def handler(event, _context):
    event["response"]["autoConfirmUser"] = True
    event["response"]["autoVerifyEmail"] = True
    return event
