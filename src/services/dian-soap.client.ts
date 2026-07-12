import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as https from 'https';

export interface SendBillResponse {
  TrackId: string;
  StatusCode: string;
  StatusDescription: string;
}

export interface GetStatusResponse {
  StatusCode: string;
  StatusDescription: string;
  XmlBytes: string;
}

@Injectable()
export class DianSoapClient {
  private readonly logger = new Logger(DianSoapClient.name);

  constructor(private configService: ConfigService) {}

  private getBaseUrl(): string {
    const env = this.configService.get<string>('DIAN_ENVIRONMENT') || 'habilitacion';
    return env === 'produccion'
      ? this.configService.get<string>('DIAN_PRODUCCION_URL')!
      : this.configService.get<string>('DIAN_HABILITACION_URL')!;
  }

  private getSoapAction(operation: string): string {
    return `http://wcf.dian.colombia/IWcfDianCustomerServices/${operation}`;
  }

  async sendBillAsync(fileName: string, contentFileBase64: string): Promise<SendBillResponse> {
    const url = this.getBaseUrl();
    const soapBody = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
                     xmlns:wcf="http://wcf.dian.colombia">
        <soap:Header/>
        <soap:Body>
          <wcf:SendBillAsync>
            <wcf:fileName>${fileName}</wcf:fileName>
            <wcf:contentFile>${contentFileBase64}</wcf:contentFile>
          </wcf:SendBillAsync>
        </soap:Body>
      </soap:Envelope>`;

    return this.callSoap(url, 'SendBillAsync', soapBody);
  }

  async getStatus(trackId: string): Promise<GetStatusResponse> {
    const url = this.getBaseUrl();
    const soapBody = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
                     xmlns:wcf="http://wcf.dian.colombia">
        <soap:Header/>
        <soap:Body>
          <wcf:GetStatus>
            <wcf:trackId>${trackId}</wcf:trackId>
          </wcf:GetStatus>
        </soap:Body>
      </soap:Envelope>`;

    return this.callSoap(url, 'GetStatus', soapBody);
  }

  async getStatusZip(trackZipBase64: string): Promise<{ StatusCode: string; StatusMessage: string; XmlBytes: string }> {
    const url = this.getBaseUrl();
    const soapBody = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
                     xmlns:wcf="http://wcf.dian.colombia">
        <soap:Header/>
        <soap:Body>
          <wcf:GetStatusZip>
            <wcf:trackZip>${trackZipBase64}</wcf:trackZip>
          </wcf:GetStatusZip>
        </soap:Body>
      </soap:Envelope>`;

    try {
      const response = await this.makeSoapRequest(url, 'GetStatusZip', soapBody);
      return this.parseGetStatusZipResponse(response);
    } catch (err) {
      this.logger.error(`GetStatusZip error: ${(err as Error).message}`);
      return { StatusCode: '99', StatusMessage: (err as Error).message, XmlBytes: '' };
    }
  }

  async getNumberingRange(accountId: string, accountCode: string): Promise<any[]> {
    const url = this.getBaseUrl();
    const soapBody = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
                     xmlns:wcf="http://wcf.dian.colombia">
        <soap:Header/>
        <soap:Body>
          <wcf:GetNumberingRange>
            <wcf:accountID>${accountId}</wcf:accountID>
            <wcf:accountCode>${accountCode}</wcf:accountCode>
          </wcf:GetNumberingRange>
        </soap:Body>
      </soap:Envelope>`;

    const response = await this.makeSoapRequest(url, 'GetNumberingRange', soapBody);
    return this.parseGetNumberingRangeResponse(response);
  }

  private async callSoap(url: string, operation: string, body: string): Promise<any> {
    const response = await this.makeSoapRequest(url, operation, body);
    return this.parseSoapResponse(response, operation);
  }

  private async makeSoapRequest(url: string, operation: string, body: string): Promise<string> {
    const agent = new https.Agent({ rejectUnauthorized: true });
    const connectionTimeout = this.configService.get<number>('DIAN_TIMEOUT_CONNECTION') || 15000;
    const readTimeout = this.configService.get<number>('DIAN_TIMEOUT_READ') || 60000;
    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/soap+xml;charset=UTF-8;action="' + this.getSoapAction(operation) + '"',
        'SOAPAction': this.getSoapAction(operation),
      },
      httpsAgent: agent,
      timeout: readTimeout,
      transitional: {
        clarifyTimeoutError: true,
      },
    });
    return response.data;
  }

  private parseSoapResponse(xml: string, operation: string): any {
    const extractTag = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
      const match = xml.match(regex);
      return match ? match[1].trim() : '';
    };

    if (operation === 'SendBillAsync') {
      return {
        TrackId: extractTag('TrackId'),
        StatusCode: extractTag('StatusCode') || extractTag('a:StatusCode'),
        StatusDescription: extractTag('StatusDescription') || extractTag('a:StatusDescription'),
      };
    }
    if (operation === 'GetStatus') {
      return {
        StatusCode: extractTag('StatusCode') || extractTag('a:StatusCode'),
        StatusDescription: extractTag('StatusDescription') || extractTag('a:StatusDescription'),
        XmlBytes: extractTag('XmlBytes') || extractTag('a:XmlBytes'),
      };
    }
    return {};
  }

  private parseGetStatusZipResponse(xml: string): { StatusCode: string; StatusMessage: string; XmlBytes: string } {
    const extractTag = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
      const match = xml.match(regex);
      return match ? match[1].trim() : '';
    };
    return {
      StatusCode: extractTag('StatusCode') || extractTag('a:StatusCode'),
      StatusMessage: extractTag('StatusMessage') || extractTag('a:StatusMessage'),
      XmlBytes: extractTag('XmlBytes') || extractTag('a:XmlBytes'),
    };
  }

  private parseGetNumberingRangeResponse(xml: string): any[] {
    const ranges: any[] = [];
    const rangeRegex = /<AuthorizationRange[\s\S]*?<\/AuthorizationRange>/g;
    let match;
    while ((match = rangeRegex.exec(xml)) !== null) {
      const rangeXml = match[0];
      const extractTag = (tag: string) => {
        const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
        const m = rangeXml.match(r);
        return m ? m[1].trim() : '';
      };
      ranges.push({
        Prefix: extractTag('Prefix'),
        From: extractTag('From'),
        To: extractTag('To'),
        ValidFrom: extractTag('ValidFrom'),
        ValidTo: extractTag('ValidTo'),
      });
    }
    return ranges;
  }
}
