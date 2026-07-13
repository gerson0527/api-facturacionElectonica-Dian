import { Injectable, Logger } from "@nestjs/common";
import { create } from "xmlbuilder2";

export interface DianValidationRule {
  ruleId: string;
  message: string;
}

export interface DianApplicationResponse {
  isAccepted: boolean;
  responseCode: string; // "00" para aceptado, "02", "04" rechazos
  responseMessage: string;
  validationRules: DianValidationRule[];
}

@Injectable()
export class DianResponseService {
  private readonly logger = new Logger(DianResponseService.name);

  parseApplicationResponse(xmlString: string): DianApplicationResponse {
    try {
      const doc = create(xmlString).toObject() as any;

      // Navegar por la estructura ApplicationResponse
      const appResponse = doc["ApplicationResponse"] || doc["urn:ApplicationResponse"] || doc["urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2:ApplicationResponse"];
      
      if (!appResponse) {
        throw new Error("No es un ApplicationResponse válido");
      }

      const docResponse = Array.isArray(appResponse["cac:DocumentResponse"]) 
        ? appResponse["cac:DocumentResponse"][0] 
        : appResponse["cac:DocumentResponse"];

      const responseNode = docResponse ? docResponse["cac:Response"] : null;
      
      const responseCodeObj = responseNode ? responseNode["cbc:ResponseCode"] : null;
      const responseCode = responseCodeObj 
        ? (typeof responseCodeObj === "string" ? responseCodeObj : responseCodeObj["#text"] || responseCodeObj["_text"]) 
        : "";

      const responseDescObj = responseNode ? responseNode["cbc:Description"] : null;
      const responseMessage = responseDescObj 
        ? (typeof responseDescObj === "string" ? responseDescObj : responseDescObj["#text"] || responseDescObj["_text"]) 
        : "";

      const isAccepted = responseCode === "00" || responseCode === "0" || responseCode === "02";

      const validationRules: DianValidationRule[] = [];
      const lineResponseList = docResponse && docResponse["cac:LineResponse"]
        ? (Array.isArray(docResponse["cac:LineResponse"]) ? docResponse["cac:LineResponse"] : [docResponse["cac:LineResponse"]])
        : [];

      for (const line of lineResponseList) {
        const lineResp = line["cac:Response"];
        if (!lineResp) continue;

        const codeObj = lineResp["cbc:ResponseCode"];
        const descObj = lineResp["cbc:Description"];
        
        const rCode = codeObj ? (typeof codeObj === "string" ? codeObj : codeObj["#text"] || codeObj["_text"]) : "";
        const rDesc = descObj ? (typeof descObj === "string" ? descObj : descObj["#text"] || descObj["_text"]) : "";

        if (rCode) {
          validationRules.push({
            ruleId: rCode,
            message: rDesc,
          });
        }
      }

      return {
        isAccepted,
        responseCode,
        responseMessage,
        validationRules,
      };
    } catch (err: any) {
      this.logger.error(`Error parsing ApplicationResponse: ${err.message}`);
      return {
        isAccepted: false,
        responseCode: "99",
        responseMessage: `Error parseando respuesta DIAN: ${err.message}`,
        validationRules: [],
      };
    }
  }
}
