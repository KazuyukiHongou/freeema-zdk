// 実行環境毎の設定
// @ts-ignore
const rinkebyDai = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const rinkebyWeenus = '0xaFF4481D10270F50f203E0763e2597776068CBc5'

interface chainInfo {
  network: string;
  chainId: number;
  rpcUrl: string;
  currency: string;
  mediaAddress: string;
  marketAddress: string;
}
export const chainInfoMainnet: chainInfo = {
  network: 'mainnnet',
  chainId: 1,
  rpcUrl: '',
  currency: '',
  mediaAddress: '',
  marketAddress: '',
}

export const chainInfoRinkeby: chainInfo = {
  network: 'rinkeby',
  chainId: 4,
  rpcUrl: 'https://rinkeby.infura.io/v3/4561d58b8e6c41bb966ef6ea1dc10bdf',
  currency: rinkebyWeenus,
  mediaAddress: '',
  marketAddress: '',
}

export const chainInfoLocal: chainInfo = {
  network: 'local',
  chainId: 50,
  rpcUrl: '',
  currency: '',
  mediaAddress: '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401',
  marketAddress: '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48',
}
