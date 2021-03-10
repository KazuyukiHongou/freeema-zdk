import {
  Ask,
  Bid,
  BidShares,
  constructAsk,
  constructBid,
  constructBidShares,
  constructMediaData,
  Decimal,
  generateMetadata,
  sha256FromBuffer,
  // @ts-ignore
  signMintWithSigMessage,
  // @ts-ignore
  signPermitMessage,
  Zora,
  chainInfoMainnet, chainInfoRinkeby, chainInfoLocal
} from './'
import { Provider } from '@ethersproject/providers'
import { Signer } from '@ethersproject/abstract-signer'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { BaseErc20Factory } from '@zoralabs/core/dist/typechain'

// @ts-ignore
import { addresses as ZoraAddresses } from './addresses'
// @ts-ignore
import { deployCurrency, setupZora, ZoraConfiguredAddresses, approveCurrency } from '../tests/helpers'
import { Blockchain, generatedWallets } from '@zoralabs/core/dist/utils'
// @ts-ignore
import { BigNumber, Bytes } from 'ethers'
// @ts-ignore
import { formatUnits } from 'ethers/lib/utils'
// @ts-ignore
import { AddressZero } from '@ethersproject/constants'
// @ts-ignore
import { FreeemaMediaFactory } from '../typechain'
// @ts-ignore
import MockAdapter from 'axios-mock-adapter'
// @ts-ignore
import axios from 'axios'
// @ts-ignore
import { promises as fs } from 'fs'

let retryCount = 5;

let currentChainInfo = chainInfoLocal;
let execFunctions = [
  'test1',
  'test2',
  'test3',
  'execMint',
  'execMintWithSig',
  'acceptBid',
  'updateContentURI',
  'ask',
  'resale',
  'addItemSale'
];

if (process.argv[2]) {
  if (process.argv[2] == 'mainnet') {
    currentChainInfo = chainInfoMainnet;
  } else if (process.argv[2] == 'rinkeby') {
    currentChainInfo = chainInfoRinkeby;
  }
}

if (process.argv[3]) {
  execFunctions = process.argv[3].split(',')
}

let provider = new JsonRpcProvider(currentChainInfo.rpcUrl)
let blockchain = new Blockchain(provider)
let defaultBidShares: BidShares
// @ts-ignore
let defaultAsk: Ask
let defaultBid: Bid

let zoraConfig: ZoraConfiguredAddresses
let [mainWallet, otherWallet, thirdWallet, fourthWallet] = generatedWallets(provider)
/*
console.log('mainWallet')
console.log(mainWallet)
console.log('otherWallet')
console.log(otherWallet)
console.log('thirdWallet')
console.log(thirdWallet)
console.log('fourthWallet')
console.log(fourthWallet)
*/

let mainZora: Zora;

const tokenIdFirst  = BigNumber.from("1000001");

exec();

async function exec() {
  await init();
  for (let i = 0; i < execFunctions.length; i++) {
    switch (execFunctions[i]) {
      case 'test1':
        test1()
        break
      case 'test2':
        test2()
        break
      case 'test3':
        test3()
        break
      case 'execMint':
        await execMint("test1", mainZora)
        break
      case 'execMintWithSig':
        await execMintWithSig()
        break
      case 'acceptBid':
        await acceptBid()
        break
      case 'updateContentURI':
        await updateContentURI()
        break
      case 'ask':
        await ask(process.argv[4])
        break
      case 'resale':
        await resale(process.argv[4])
        break
      case 'addItemSale':
        await addItemSale()
        break
      default:
        break
    }
  }
}


// -------- hands on functions --------

// @ts-ignore
function test1() {
  console.log('start test1')
  const wallet = Wallet.createRandom()

  const zora = new Zora(
    wallet,
    currentChainInfo.chainId,
    currentChainInfo.mediaAddress,
    currentChainInfo.marketAddress
  );
  console.log(`zora.readOnly: ${zora.readOnly}`);
}
// @ts-ignore
function test2() {
  console.log('start test2')

  const zora = new Zora(
    provider,
    currentChainInfo.chainId,
    currentChainInfo.mediaAddress,
    currentChainInfo.marketAddress
  )
  console.log(`zora.readOnly: ${zora.readOnly}`);
}
// @ts-ignore
function test3() {
  console.log('start test3')
  const wallet = Wallet.createRandom()
  const rinkebyMediaAddress = ZoraAddresses['rinkeby'].media
  const rinkebyMarketAddress = ZoraAddresses['rinkeby'].market
  const zora = new Zora(
    wallet,
    currentChainInfo.chainId,
    currentChainInfo.mediaAddress,
    currentChainInfo.marketAddress
  );
  console.log(`currentChainInfo.chainId: ${currentChainInfo.chainId}`);
  console.log(`rinkebyMediaAddress: ${rinkebyMediaAddress}`);
  console.log(`rinkebyMarketAddress: ${rinkebyMarketAddress}`);
  console.log(`zora.marketAddress: ${zora.marketAddress}`);
  console.log(`zora.mediaAddress: ${zora.mediaAddress}`);
  console.log(`zora.market.address: ${zora.market.address}`);
  console.log(`zora.media.address: ${zora.media.address}`);
}

// @ts-ignore
async function updateContentURI() {
  console.log(`updateContentURI ---------------------------------------------`)
  await init();

  console.log(`currentChainInfo.chainId: ${currentChainInfo.chainId}`)
  console.log(`zoraConfig.media: ${zoraConfig.media}`)
  console.log(`zoraConfig.market: ${zoraConfig.market}`)

  let totalMediaCount = await mainZora.fetchTotalMedia()
  console.log(`totalMediaCount: ${totalMediaCount}`)

  let media = await createMedia(`update_test1_${new Date().getTime()}`);
  const mintRet = await mainZora.mint(media.mediaData, defaultBidShares)
  console.log(`mintRet:`)
  console.log(mintRet)

  // トランザクション成功直後だと、まだブロックチェーンに反映されていなくてエラーになるためリトライする
  for (let i = 0; i < retryCount; i++) {
    try {
      const tokenURI = await mainZora.fetchContentURI(totalMediaCount)
      console.log(`tokenURI: ${tokenURI}`)

      await mainZora.updateContentURI(totalMediaCount, 'https://newURI.com')

      const newTokenURI = await mainZora.fetchContentURI(totalMediaCount)
      console.log(`newTokenURI: ${newTokenURI}`)
      break
    } catch (e) {
      console.log('sleep')
      await sleep(5000)
    }
  }
}
// @ts-ignore
// return tokenId
async function execMint(_text: string, _zora: Zora) {
  console.log(`execMint ---------------------------------------------`)

  const totalSupply = await _zora.fetchTotalMedia()
  console.log(`totalSupply: ${totalSupply}`)
  let media = await createMedia(_text + `_${new Date().getTime()}`);
  //console.log(media);

  // @ts-ignore
  const mintRes = await _zora.mint(media.mediaData, defaultBidShares);
  //console.log('mintRes:')
  //console.log(mintRes)
  const tokenId = totalSupply.toNumber();

  // トランザクション成功直後だと、まだブロックチェーンに反映されていなくてエラーになるためリトライする
  for (let i = 0; i < retryCount; i++) {
    try {
      const tokenURI1 = await _zora.fetchContentURI(tokenId)
      console.log(`tokenURI1: ${tokenURI1}`)
      break
    } catch (e) {
      console.log('sleep')
      await sleep(5000)
    }
  }
  return tokenId;
}


// @ts-ignore
async function execMintWithSig(){
  console.log(`execMintWithSig ---------------------------------------------`)

  let media = await createMedia(`test3_${new Date().getTime()}`);

  const otherZora = await getZora(otherWallet)
  const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 // 24 hours
  const domain = otherZora.eip712Domain()

  console.log(`domain`)
  console.log(domain)
  console.log(`mainWallet.address: ${mainWallet.address}`)
  console.log(`otherWallet.address: ${otherWallet.address}`)
  const nonce = await otherZora.fetchMintWithSigNonce(mainWallet.address)
  console.log(`nonce: ${nonce}`)
  const eipSig = await signMintWithSigMessage(
    mainWallet,
    media.contentHash,
    media.metadataHash,
    Decimal.new(10).value,
    nonce.toNumber(),
    deadline,
    domain
  )
  console.log(`eipSig: `)
  console.log(eipSig)

  const totalSupply = await otherZora.fetchTotalMedia()
  const tokenId = totalSupply.toNumber();
  console.log(tokenId);

  const mintWithSigRes = await otherZora.mintWithSig(
    mainWallet.address,
    media.mediaData,
    defaultBidShares,
    eipSig
  )

  console.log('mintWithSigRes')
  console.log(mintWithSigRes)

  // トランザクション成功直後だと、まだブロックチェーンに反映されていなくてエラーになるためリトライする
  for (let i = 0; i < retryCount; i++) {
    try {
      const owner = await otherZora.fetchOwnerOf(tokenId)
      const creator = await otherZora.fetchCreator(tokenId)
      const onChainContentHash = await otherZora.fetchContentHash(tokenId)
      const onChainMetadataHash = await otherZora.fetchMetadataHash(tokenId)
      const onChainBidShares = await otherZora.fetchCurrentBidShares(tokenId)
      const onChainContentURI = await otherZora.fetchContentURI(tokenId)
      const onChainMetadataURI = await otherZora.fetchMetadataURI(tokenId)

      console.log(`owner: ${owner.toLowerCase()}`)
      console.log(`creator: ${creator.toLowerCase()}`)
      console.log(`onChainContentHash: ${onChainContentHash}`)
      console.log(`onChainContentURI: ${onChainContentURI}`)
      console.log(`onChainMetadataURI: ${onChainMetadataURI}`)
      console.log(`onChainMetadataHash: ${onChainMetadataHash}`)
      console.log('onChainBidShares: ')
      console.log(onChainBidShares)
      break
    } catch (e) {
      console.log('sleep')
      await sleep(5000)
    }
  }
}
// @ts-ignore
async function acceptBid(){
  console.log(`acceptBid ---------------------------------------------`)

  let media = await createMedia(`bitToken_${new Date().getTime()}`);
  const totalSupply = await mainZora.fetchTotalMedia()
  const mintRes = await mainZora.mint(media.mediaData, defaultBidShares)
  console.log('mintRes:')
  console.log(mintRes)

  let tokenId: number
  let otherZora: Zora
  for (let i = 0; i < retryCount; i++) {
    try {
      tokenId = totalSupply.toNumber();
      console.log("mint tokenId : " + tokenId)
      console.log("owner: " + await mainZora.fetchOwnerOf(tokenId));

      otherZora = await getZora(otherWallet)

      const nullOnChainBid = await otherZora.fetchCurrentBidForBidder(
        tokenId,
        otherWallet.address
      )

      console.log(`nullOnChainBid.currency: ${nullOnChainBid.currency}`)
      console.log(`AddressZero: ${AddressZero}`)

      setBid(tokenId, otherZora, defaultBid)

      const onChainBid = await otherZora.fetchCurrentBidForBidder(
        tokenId,
        otherWallet.address
      )
      console.log(`onChainBid`)
      console.log(onChainBid)
      break
    } catch (e) {
      console.log(e)
      console.log('sleep')
      await sleep(5000)
    }
  }
  for (let i = 0; i < retryCount; i++) {
    try {
      console.log('start acceptBid')
      // @ts-ignore
      const acceptBidRes = await mainZora.acceptBid(tokenId, defaultBid)
      console.log('acceptBidRes:')
      console.log(acceptBidRes)
      // @ts-ignore
      console.log("new owner: " + await otherZora.fetchOwnerOf(tokenId));
      break
    } catch (e) {
      console.log(e)
      console.log('sleep')
      await sleep(5000)
    }
  }
}

// @ts-ignore
async function ask(_tokenId){
  console.log(`# ask ---------------------------------------------`)
  //mint
  let tokenId = _tokenId;
  if (_tokenId == undefined) {
    tokenId = await execMint("ask", mainZora)
  }
  console.log(tokenId)
  //askセット
  const askResult = await setAsk(tokenId, mainZora, defaultAsk);
  console.log('askResult:')
  console.log(askResult)
  console.log("before_bit_owner: " + await mainZora.fetchOwnerOf(tokenId));

  //他ユーザがbit
  const otherZora = await getZora(otherWallet)
  const newBid = constructBid(
    zoraConfig.currency,
    Decimal.new(100).value,
    otherWallet.address,
    otherWallet.address,
    10
  )

  await setBid(tokenId, otherZora, newBid);

  console.log("bid_account: " + otherWallet.address);
  for (let i = 0; i < retryCount; i++) {
    let newOwner = await mainZora.fetchOwnerOf(tokenId)
    if (newOwner != otherWallet.address) {
      console.log('sleep (check for owner is changed)')
      await sleep(5000)
    } else {
      console.log("after_bit_owner: " + await mainZora.fetchOwnerOf(tokenId))
      break
    }
  }

}

// @ts-ignore
async function setAsk(_tokenId: number, _zora: Zora, _ask: Ask){
  console.log(`## setAsk --------------------`)
  console.log(defaultAsk);
  for (let i = 0; i < retryCount; i++) {
    try {
      await _zora.setAsk(_tokenId, _ask)
      const onChainAsk = await mainZora.fetchCurrentAsk(_tokenId)
      //console.log('onChainAsk: ')
      //console.log(onChainAsk);
      // ローカル以外の場合は setAsk してすぐに関連する操作をしようとするとエラーになるため sleep を入れる
      if (currentChainInfo.network != 'local') {
        console.log('sleep (setAsk after)')
        await sleep(20000)
      }
      return onChainAsk
    } catch (e) {
      console.log(e)
      console.log('sleep')
      await sleep(5000)
    }
  }
}

async function setBid(_tokenId: number, _zora: Zora, _bid: Bid){
  console.log('## setBid ------------------------')
  //console.log(defaultBid)
  for (let i = 0; i < retryCount; i++) {
    try {
      //@ts-ignore
      const setBidRes = await _zora.setBid(_tokenId, _bid)
      console.log('setBidRes:')
      console.log(setBidRes)
      // ローカル以外の場合は setBid してすぐに関連する操作をしようとするとエラーになるため sleep を入れる
      if (currentChainInfo.network != 'local') {
        console.log('sleep (setBid after)')
        await sleep(20000)
      }
      return
    } catch (e) {
      console.log(e)
      console.log('sleep')
      await sleep(5000)
    }
  }
}

// @ts-ignore
//転売
async function resale(_tokenId){
  console.log('# resale ------------------------------------------------')
  await init();
  const amount = 10;
  const ask = constructAsk(zoraConfig.currency, Decimal.new(amount).value)
  //BidShares変更 (creator, owner, prevOwner)
  defaultBidShares = constructBidShares(20, 70, 10);

  //mint
  let tokenId = _tokenId;
  if (_tokenId == undefined) {
    tokenId = await execMint("resale", mainZora)
  }
  console.log("owner: " + await mainZora.fetchOwnerOf(tokenId));

  //set ask
  await setAsk(tokenId, mainZora, ask);

  console.log("1. main - other - third : WalletBalances")
  console.log( await getBalance(mainWallet.address));
  console.log( await getBalance(otherWallet.address));
  console.log( await getBalance(thirdWallet.address));
  console.log( await getBalance(fourthWallet.address));

  //他ユーザがbit
  const otherZora = await getZora(otherWallet)
  const bid = constructBid(zoraConfig.currency, Decimal.new(amount).value, otherWallet.address, otherWallet.address, 10)
  await setBid(tokenId, otherZora, bid);

  console.log("main -> other : 10")
  console.log("owner: " + await mainZora.fetchOwnerOf(tokenId));

  console.log("2. main - other - third : WalletBalances")
  console.log( await getBalance(mainWallet.address));
  console.log( await getBalance(otherWallet.address));
  console.log( await getBalance(thirdWallet.address));
  console.log( await getBalance(fourthWallet.address));

  //他ユーザがask
  await setAsk(tokenId, otherZora, ask);

  //thirdユーザがbit
  const thirdZora = await getZora(thirdWallet)
  const bid2 = constructBid(zoraConfig.currency, Decimal.new(amount).value, thirdWallet.address, thirdWallet.address, 10)
  await setBid(tokenId, thirdZora, bid2);

  console.log("other -> third : 10")
  console.log("owner: " + await mainZora.fetchOwnerOf(tokenId));

  console.log("3. main - other - third : WalletBalances")
  console.log( await getBalance(mainWallet.address));
  console.log( await getBalance(otherWallet.address));
  console.log( await getBalance(thirdWallet.address));
  console.log( await getBalance(fourthWallet.address));

  //3ユーザがask
  await setAsk(tokenId, thirdZora, ask);

  //4ユーザがbit
  const fourthWalletZora = await getZora(fourthWallet)
  const bid3 = constructBid(zoraConfig.currency, Decimal.new(amount).value, fourthWallet.address, fourthWallet.address, 10)
  await setBid(tokenId, fourthWalletZora, bid3);

  console.log("3 -> 4 : 10")
  console.log("owner: " + await mainZora.fetchOwnerOf(tokenId));

  console.log("4. main - other - third : WalletBalances")
  console.log( await getBalance(mainWallet.address));
  console.log( await getBalance(otherWallet.address));
  console.log( await getBalance(thirdWallet.address));
  console.log( await getBalance(fourthWallet.address));

}

async function addItemSale(){
  console.log('# addItemSale ------------------------------------------------')
  await init();
  const amount = 10;
  const ask = constructAsk(zoraConfig.currency, Decimal.new(amount).value)
  let media = await createMedia(`addItemSale_${new Date().getTime()}`);
  //BidShares変更 (creator, owner, prevOwner)
  defaultBidShares = constructBidShares(20, 70, 10);

  mainZora.addItemSale(media.mediaData, defaultBidShares, ask, BigNumber.from(10))

  // トランザクション成功直後だと、まだブロックチェーンに反映されていなくてエラーになるためリトライする
  for (let i = 0; i < retryCount; i++) {
    try {
      const tokenURI1 = await mainZora.fetchContentURI(tokenIdFirst)
      console.log(`tokenURI1: ${tokenURI1}`)
      const creator = await mainZora.fetchCreator(tokenIdFirst)
      console.log(`creator: ${creator}`)
      const totalSupply = await mainZora.fetchTotalMedia()
      console.log(`totalSupply: ${totalSupply}`)
      const ask = await mainZora.fetchCurrentAsk(tokenIdFirst)
      console.log(`ask:`)
      console.log(ask)
      break
    } catch (e) {
      console.log('sleep')
      await sleep(5000)
    }
  }
}
// -------- libraries for hands on --------

async function init() {
  if (currentChainInfo.chainId >= 50) {
    await blockchain.resetAsync()
    zoraConfig = await setupZora(mainWallet, [otherWallet, thirdWallet, fourthWallet])

    console.log("balances ----------------------------------------------------")
    console.log( await getBalance(mainWallet.address));
    console.log( await getBalance(otherWallet.address));
    console.log( await getBalance(thirdWallet.address));
    console.log( await getBalance(fourthWallet.address));

  } else {
    const zora = new Zora(mainWallet, currentChainInfo.chainId)

    await approveCurrency(mainWallet, currentChainInfo.currency, zora.marketAddress)
    await approveCurrency(otherWallet, currentChainInfo.currency, zora.marketAddress)
    await approveCurrency(thirdWallet, currentChainInfo.currency, zora.marketAddress)
    await approveCurrency(fourthWallet, currentChainInfo.currency, zora.marketAddress)

    zoraConfig = {
      currency: currentChainInfo.currency,
      media: zora.mediaAddress,
      market: zora.marketAddress,
    }
  }

  mainZora = await getZora(mainWallet)

  defaultBidShares = constructBidShares(10, 90, 0)
  defaultAsk = constructAsk(zoraConfig.currency, Decimal.new(100).value)
  console.log(`Decimal.new(99).value: ${Decimal.new(99).value}`)
  defaultBid = constructBid(
    zoraConfig.currency,
    Decimal.new(9).value,
    otherWallet.address,
    otherWallet.address,
    10
  )
}

async function getZora(signerOrProvider: Signer | Provider) {
  return new Zora(signerOrProvider, currentChainInfo.chainId, zoraConfig.media, zoraConfig.market)
}

async function createMedia(_text : string){
  //商品付与メタデータ
  let meta = {
    version: 'zora-20210101', //これはzoraプロトコルのバージョン
    name: 'name : ' + _text, //商品名
    description: 'description : ' + _text, //商品説明
    mimeType: 'text/plain', //商品タイプ
  }
  let minifiedMeta = generateMetadata(meta.version, meta)
  let t_metadataHash = sha256FromBuffer(Buffer.from(minifiedMeta))

  //商品コンテンツデータ mintはこれが唯一無二である必要がある
  let t_contentHash = sha256FromBuffer(Buffer.from('invert' + _text))

  //Mediaトークン用データ生成
  let t_defaultMediaData = constructMediaData(
    'https://example.com/' + _text, //外部Dappsストレージにある商品実態のURI
    'https://metadata.com/' + _text, //外部Dappsストレージにある商品実態のメタデータURL
    t_contentHash,
    t_metadataHash
  )
  return { mediaData : t_defaultMediaData,  contentHash: t_contentHash, metadataHash : t_metadataHash,};
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function getBalance(owner: string) {
  return formatUnits(await BaseErc20Factory.connect(zoraConfig.currency, mainWallet).balanceOf(owner), 'ether');
}
