import { Network } from "@/lib/survey/types";

const DEFAULT_ENDPOINTS: Record<Network, string> = {
  mainnet: process.env.TON_JSONRPC_MAINNET ?? "https://toncenter.com/api/v2/jsonRPC",
  testnet: process.env.TON_JSONRPC_TESTNET ?? "https://testnet.toncenter.com/api/v2/jsonRPC",
};

const DEFAULT_API_KEYS: Partial<Record<Network, string>> = {
  mainnet: process.env.TONCENTER_MAINNET_API_KEY,
  testnet: process.env.TONCENTER_TESTNET_API_KEY,
};

export type TonStackItem = [string, unknown];

export type RunGetMethodResult = {
  "@type": "smc.runResult";
  gas_used: number;
  stack: TonStackItem[];
  exit_code: number;
  [key: string]: unknown;
};

export type TonTransaction = {
  "@type": string;
  utime: number;
  data: string;
  address: {
    "@type": string;
    account_address: string;
  };
  fee: string;
  storage_fee: string;
  other_fee: string;
  in_msg?: {
    source?: string;
    destination?: string;
    value?: string;
    body?: string;
    message?: string;
    hash?: string;
    fwd_fee?: string;
    ihr_fee?: string;
    created_lt?: string;
    "@type"?: string;
    [key: string]: unknown;
  };
  out_msgs?: unknown[];
  transaction_id?: {
    lt: string;
    hash: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export class TonJsonRpcClient {
  private readonly endpoint: string;
  private readonly apiKey?: string;

  constructor(options: { network: Network; endpointOverride?: string | null; apiKeyOverride?: string | null }) {
    this.endpoint = (options.endpointOverride?.trim() || DEFAULT_ENDPOINTS[options.network]) as string;
    this.apiKey = options.apiKeyOverride?.trim() || DEFAULT_API_KEYS[options.network] || undefined;
  }

  async runGetMethod(params: { address: string; method: string; stack?: TonStackItem[] }) {
    return this.request<RunGetMethodResult>("runGetMethod", {
      address: params.address,
      method: params.method,
      stack: params.stack ?? [],
    });
  }

  async getTransactions(params: { address: string; limit?: number; lt?: string; hash?: string }) {
    return this.request<TonTransaction[]>("getTransactions", {
      address: params.address,
      limit: params.limit ?? 5,
      lt: params.lt,
      hash: params.hash,
    });
  }

  async getMasterchainInfo() {
    return this.request<{ last: Record<string, unknown> }>("getMasterchainInfo");
  }

  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: `${method}-${Date.now()}`,
      method,
      params,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`RPC ${method} failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { ok?: boolean; result?: T; error?: string };
    if (!payload.ok) {
      throw new Error(payload.error || `RPC ${method} returned unknown error`);
    }

    if (typeof payload.result === "undefined") {
      throw new Error(`RPC ${method} did not return a result`);
    }

    return payload.result;
  }
}
