import axios, { type AxiosInstance } from "axios";
import { nusaworkConfig } from "../config/nusawork.config";
import type { INusaworkClient, NusaworkEmployeeRaw } from "../interface/nusawork.interface";

export class NusaworkClient implements INusaworkClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: nusaworkConfig.apiUrl,
      headers: { Accept: "application/json" },
    });
  }

  private async getToken(): Promise<string> {
    const res = await this.http.post<any>(
      "/auth/api/oauth/token",
      {
        grant_type: "client_credentials",
        client_id: nusaworkConfig.clientId,
        client_secret: nusaworkConfig.clientSecret,
      },
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    return res.data.access_token as string;
  }

  async getEmployees(): Promise<NusaworkEmployeeRaw[]> {
    const token = await this.getToken();

    const res = await this.http.post<any>(
      "/emp/api/v4.2/client/employee/filter",
      {
        fields: { active_status: ["active"] },
        is_paginate: false,
        multi_value: false,
        currentPage: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return (res?.data?.data as NusaworkEmployeeRaw[]) ?? [];
  }
}
