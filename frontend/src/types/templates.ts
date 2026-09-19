export type PaperSize = 'a4' | 'a5' | 'thermal_80' | 'thermal_58';
export type TemplateFont = 'inter' | 'roboto' | 'poppins' | 'outfit' | 'serif' | 'mono' | 'system';
export type FontSizeScale = 'small' | 'medium' | 'large';
export type LogoPosition = 'left' | 'center' | 'right';

export interface TemplateConfig {
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  textColor?: string;
  fontFamily: TemplateFont;
  fontSize: FontSizeScale;
  paperSize: PaperSize;
  invoiceTitle: string;
  showLogo: boolean;
  logoPosition: LogoPosition;
  showCompanyPhone: boolean;
  showCompanyEmail: boolean;
  showCompanyGstin: boolean;
  showCompanyAddress: boolean;
  showBankDetails: boolean;
  showUpiQr: boolean;
  showHsnCode: boolean;
  showUnit: boolean;
  showDiscount: boolean;
  showGstBreakdown: boolean;
  showAmountInWords: boolean;
  showRoundOff: boolean;
  showPaymentStatusBadge: boolean;
  showAuthorizedSignatory: boolean;
  signatoryTitle?: string;
  signatoryLabel?: string;
  signatureImage?: string;
  customTerms?: string;
  customNotes?: string;
  footerNote?: string;
  watermarkText?: string;
  headerStyle?: 'bar' | 'clean' | 'boxed' | 'centered' | 'gradient';
}

export interface PresetTemplate {
  id: string;
  name: string;
  templateType: string;
  category: 'A4 Standard' | 'Thermal POS' | 'Specialty';
  description: string;
  badge?: string;
  previewGradient: string;
  config: TemplateConfig;
}

export interface InvoiceTemplateRecord {
  id: string;
  companyId: string;
  name: string;
  templateType: string;
  isDefault: boolean;
  config: TemplateConfig;
  createdAt: string;
  updatedAt: string;
}
