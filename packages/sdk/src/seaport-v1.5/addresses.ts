import { ChainIdToAddress, Network } from "../utils";

export const Exchange: ChainIdToAddress = {
  [Network.Ethereum]: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  [Network.EthereumGoerli]: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  [Network.Bsc]: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  [Network.Optimism]: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  [Network.Gnosis]: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  [Network.Polygon]: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  [Network.Arbitrum]: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  [Network.Avalanche]: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  [Network.ScrollAlpha]: "0x238285119ad0842051b4a46a9428139d30869b55",
};

// Zones

export const OpenSeaProtectedOffersZone: ChainIdToAddress = {
  [Network.Ethereum]: "0x000000e7ec00e7b300774b00001314b8610022b8",
  [Network.EthereumGoerli]: "0x000000e7ec00e7b300774b00001314b8610022b8",
  [Network.Bsc]: "0x000000e7ec00e7b300774b00001314b8610022b8",
  [Network.Optimism]: "0x000000e7ec00e7b300774b00001314b8610022b8",
  [Network.Gnosis]: "0x000000e7ec00e7b300774b00001314b8610022b8",
  [Network.Polygon]: "0x000000e7ec00e7b300774b00001314b8610022b8",
  [Network.Arbitrum]: "0x000000e7ec00e7b300774b00001314b8610022b8",
  [Network.Avalanche]: "0x000000e7ec00e7b300774b00001314b8610022b8",
};

// TODO: Deploy to all other supported networks
export const CancellationZone: ChainIdToAddress = {
  [Network.Ethereum]: "0xaa0e012d35cf7d6ecb6c2bf861e71248501d3226",
  [Network.EthereumGoerli]: "0x49b91d1d7b9896d28d370b75b92c2c78c1ac984a",
};