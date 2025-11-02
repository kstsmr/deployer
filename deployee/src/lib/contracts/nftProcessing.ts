import { promises as fs } from "node:fs";
import path from "node:path";
import { Cell } from "@ton/core";

const CONTRACT_DIR = path.join(process.cwd(), "contract");
const COMPILED_FILENAME = "NftProccessing.compiled.json";
const PKG_FILENAME = "NftProccessing.pkg";

export type NftProcessingState = {
  nftCollectionAddress: string | null;
  nftItemIndex: string;
  owner: string | null;
  originalOwner: string | null;
  lender: string | null;
  nft: string | null;
  loanAmount: string;
  receivedAll: string;
  nftReceived: boolean;
  status: number;
};

export type NftProcessingArtifact = {
  hash: string;
  hashBase64: string | null;
  codeBoc: string;
  dataBoc: string;
  stateInitBoc: string;
  codeHash: string;
  dataHash: string;
  sourcePath: string;
  sourcePathRelative: string;
  pkgPath: string;
  pkg: Buffer;
  decodedData: NftProcessingState | null;
  getters: string[];
};

export type NftProcessingArtifactSummary = Omit<NftProcessingArtifact, "pkg">;

let cachedArtifact: NftProcessingArtifact | null = null;

export async function getNftProcessingArtifact(): Promise<NftProcessingArtifact> {
  if (cachedArtifact) {
    return cachedArtifact;
  }

  const compiledPath = getCompiledPath();
  const pkgPath = getPkgPath();

  const [rawJson, pkgBuffer] = await Promise.all([
    fs.readFile(compiledPath, "utf8"),
    fs.readFile(pkgPath),
  ]);

  const parsed = JSON.parse(rawJson) as {
    hash?: string;
    hashBase64?: string;
    hex?: string;
  };

  if (!parsed.hex) {
    throw new Error(`Файл ${compiledPath} не содержит поле "hex"`);
  }
  if (!parsed.hash) {
    throw new Error(`Файл ${compiledPath} не содержит поле "hash"`);
  }

  const stateInitCell = Cell.fromBoc(Buffer.from(parsed.hex, "hex"))[0];
  if (stateInitCell.refs.length < 2) {
    throw new Error("State init не содержит code/data ссылок");
  }

  const codeCell = stateInitCell.refs[0]!;
  const dataCell = stateInitCell.refs[1]!;

  cachedArtifact = {
    hash: parsed.hash,
    hashBase64: parsed.hashBase64 ?? null,
    codeBoc: toBase64(codeCell),
    dataBoc: toBase64(dataCell),
    stateInitBoc: toBase64(stateInitCell),
    codeHash: codeCell.hash().toString("hex"),
    dataHash: dataCell.hash().toString("hex"),
    sourcePath: compiledPath,
    sourcePathRelative: path.relative(process.cwd(), compiledPath),
    pkgPath,
    pkg: pkgBuffer,
    decodedData: tryDecodeData(dataCell),
    getters: ["get_status", "owner"],
  };

  return cachedArtifact;
}

export async function getArtifactSummary(): Promise<NftProcessingArtifactSummary> {
  const artifact = await getNftProcessingArtifact();
  const { pkg: _pkg, ...summary } = artifact;
  void _pkg;
  return summary;
}

export async function getArtifactByHash(hash: string): Promise<NftProcessingArtifact> {
  const artifact = await getNftProcessingArtifact();
  if (artifact.hash !== hash) {
    throw new Error(
      `Не найден артефакт с hash ${hash}. Текущий доступный hash: ${artifact.hash}`
    );
  }
  return artifact;
}

function getCompiledPath(): string {
  return path.join(CONTRACT_DIR, COMPILED_FILENAME);
}

function getPkgPath(): string {
  return path.join(CONTRACT_DIR, PKG_FILENAME);
}

const toBase64 = (cell: Cell): string =>
  cell.toBoc({ idx: false, crc32: false }).toString("base64");

function tryDecodeData(dataCell: Cell): NftProcessingState | null {
  try {
    return decodeNftProcessingData(dataCell);
  } catch (error) {
    console.warn("[contracts][nft-processing] failed to decode data", error);
    return null;
  }
}

function decodeNftProcessingData(dataCell: Cell): NftProcessingState {
  const slice = dataCell.beginParse();

  const nftCollectionAddress = readMaybeAddress(slice);
  const nftItemIndex = slice.loadUintBig(64).toString();
  const nftCodeRef = slice.loadRef();
  void nftCodeRef;
  const owner = readMaybeAddress(slice);
  const originalOwner = readMaybeAddress(slice);

  const extraSlice = slice.remainingRefs > 0 ? slice.loadRef().beginParse() : null;
  const lender = extraSlice ? readMaybeAddress(extraSlice) : null;
  const nft = extraSlice ? readMaybeAddress(extraSlice) : null;
  const loanAmount = extraSlice ? extraSlice.loadCoins().toString() : "0";
  const receivedAll = extraSlice ? extraSlice.loadCoins().toString() : "0";
  const nftReceived = extraSlice ? extraSlice.loadBit() : false;
  const status = extraSlice ? extraSlice.loadUint(8) : 0;

  return {
    nftCollectionAddress,
    nftItemIndex,
    owner,
    originalOwner,
    lender,
    nft,
    loanAmount,
    receivedAll,
    nftReceived,
    status,
  };
}

function readMaybeAddress(slice: import("@ton/core").Slice): string | null {
  try {
    const address = slice.loadAddressAny();
    if (!address) {
      return null;
    }
    if ("toFriendly" in address && typeof (address as { toFriendly?: () => string }).toFriendly === "function") {
      return (address as { toFriendly: () => string }).toFriendly();
    }
    if (typeof (address as { toString?: () => string }).toString === "function") {
      return (address as { toString: () => string }).toString();
    }
    return JSON.stringify(address);
  } catch (error) {
    console.warn("[contracts][nft-processing] unexpected address format", error);
    return null;
  }
}
