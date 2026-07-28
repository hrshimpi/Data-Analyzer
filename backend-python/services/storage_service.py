from __future__ import annotations
import os

import aioboto3
from botocore.config import Config

_session = aioboto3.Session()


def bucket_name() -> str:
    return os.environ["S3_BUCKET_NAME"]


def _client_kwargs() -> dict:
    """Same code path for MinIO locally and real S3 in the cloud — only
    the environment differs.

    S3_ENDPOINT_URL / path-style addressing are MinIO-specific quirks
    (a bare `localhost:9000` endpoint can't do virtual-hosted-style
    addressing) and only apply when that var is actually set. Real AWS
    gets boto3's normal endpoint resolution and addressing.

    AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are read explicitly for
    MinIO's root user, but only passed through if both are set — if
    they're absent (e.g. a production deployment using an IAM role
    instead of static keys), boto3's default credential chain handles
    it without any code change here either.
    """
    kwargs: dict = {"region_name": os.environ.get("AWS_DEFAULT_REGION", "us-east-1")}

    endpoint_url = os.environ.get("S3_ENDPOINT_URL")
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
        kwargs["config"] = Config(s3={"addressing_style": "path"}, signature_version="s3v4")

    access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
    if access_key and secret_key:
        kwargs["aws_access_key_id"] = access_key
        kwargs["aws_secret_access_key"] = secret_key

    return kwargs


def build_key(user_id: str, dataset_id: str, filename: str) -> str:
    """{user_id}/{dataset_id}/{filename} — namespaced by user so one
    user's files can never collide with (or be guessed into) another's."""
    return f"{user_id}/{dataset_id}/{filename}"


async def upload_file(user_id: str, dataset_id: str, filename: str, file_bytes: bytes) -> str:
    key = build_key(user_id, dataset_id, filename)
    async with _session.client("s3", **_client_kwargs()) as s3:
        await s3.put_object(Bucket=bucket_name(), Key=key, Body=file_bytes)
    return key


async def get_file(s3_key: str) -> bytes:
    async with _session.client("s3", **_client_kwargs()) as s3:
        response = await s3.get_object(Bucket=bucket_name(), Key=s3_key)
        return await response["Body"].read()


async def delete_file(s3_key: str) -> None:
    async with _session.client("s3", **_client_kwargs()) as s3:
        await s3.delete_object(Bucket=bucket_name(), Key=s3_key)
