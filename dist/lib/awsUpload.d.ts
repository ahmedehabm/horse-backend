export declare const uploadImageAws: (file: Express.Multer.File) => Promise<string>;
export declare const provisionAwsDevice: (thingName: string, deviceType: string) => Promise<{
    certificatePem: string;
    privateKey: string;
}>;
//# sourceMappingURL=awsUpload.d.ts.map