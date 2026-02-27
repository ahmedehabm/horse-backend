// src/services/awsUpload.ts
import AppError from "../utils/appError.js";

export const uploadImageAws = async (file: Express.Multer.File) => {
  const base64 = file.buffer.toString("base64");

  const res = await fetch(`${process.env.AWS_LAMBDA_URL}/upload-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: base64,
      mimeType: file.mimetype,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new AppError(`Image Upload failed: ${txt}`, 401);
  }

  const data = (await res.json()) as { url: string };

  return data.url;
};

export const provisionAwsDevice = async (
  thingName: string,
  deviceType: string,
): Promise<{ certificatePem: string; privateKey: string }> => {
  const awsResponse = await fetch(
    `${process.env.AWS_LAMBDA_URL}/provision-device`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        thingName,
        deviceType,
      }),
    },
  );

  if (!awsResponse.ok) {
    const errorText = await awsResponse.text();
    throw new AppError(
      `AWS device creation failed: ${errorText}`,
      awsResponse.status === 409 ? 409 : 502,
    );
  }

  const awsData = (await awsResponse.json()) as any;

  if (!awsData.certificatePem || !awsData.privateKey) {
    throw new AppError("AWS did not return required certificates", 502);
  }

  return {
    certificatePem: awsData.certificatePem,
    privateKey: awsData.privateKey,
  };
};
