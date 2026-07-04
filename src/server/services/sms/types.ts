export type SmsDeliveryResult = {
  sent: boolean;
  mock: boolean;
  provider: "mock" | "smsir";
  messageId?: number;
};

export type SmsOtpTemplateKey = "login" | "password_reset";

export type SmsTemplateParameter = {
  name: string;
  value: string;
};

export type SmsTemplatePayload = {
  templateId: number;
  parameters: SmsTemplateParameter[];
};

export type SmsProvider = {
  id: "mock" | "smsir";
  sendOtp: (
    phone: string,
    code: string,
    template?: SmsOtpTemplateKey,
  ) => Promise<SmsDeliveryResult>;
  sendTransactional: (
    phone: string,
    message: string,
    template?: SmsTemplatePayload,
  ) => Promise<SmsDeliveryResult>;
};
