// @ts-ignore
import {
  Ask,
  Bid,
  BidShares,
  constructAsk,
  constructBid,
  constructBidShares,
  constructMediaData,
  Decimal,
  EIP712Signature,
  generateMetadata,
  MediaData,
  sha256FromBuffer,
  signMintWithSigMessage,
  // @ts-ignore
  signPermitMessage,
  Zora,
} from '../src'
import { JsonRpcProvider } from '@ethersproject/providers'
// @ts-ignore
import { Wallet } from '@ethersproject/wallet'
// @ts-ignore
import { addresses as ZoraAddresses } from '../src/addresses'
// @ts-ignore
import { deployCurrency, setupZora, ZoraConfiguredAddresses } from './helpers'
import { Blockchain, generatedWallets } from '@zoralabs/core/dist/utils'
import { BigNumber, Bytes } from 'ethers'
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
import { BigNumberish } from 'ethers'

let provider = new JsonRpcProvider()
let blockchain = new Blockchain(provider)
jest.setTimeout(1000000)

describe('Zora', () => {
  const tokenIdFirst = BigNumber.from('1000001')
  const maxSupplyLimit = BigNumber.from('999999')

  describe('#constructor', () => {
    it('throws an error if a mediaAddress is specified but not a marketAddress', () => {
      const wallet = Wallet.createRandom()
      expect(function () {
        new Zora(wallet, 4, '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401')
      }).toThrow(
        'Zora Constructor: mediaAddress and marketAddress must both be non-null or both be null'
      )
    })

    it('throws an error if the marketAddress is specified but not a mediaAddress', () => {
      const wallet = Wallet.createRandom()
      expect(function () {
        new Zora(wallet, 4, '', '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401')
      }).toThrow(
        'Zora Constructor: mediaAddress and marketAddress must both be non-null or both be null'
      )
    })

    it('throws an error if one of the market or media addresses in not a valid ethereum address', () => {
      const wallet = Wallet.createRandom()
      expect(function () {
        new Zora(
          wallet,
          4,
          'not a valid ethereum address',
          '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401'
        )
      }).toThrow('Invariant failed: not a valid ethereum address is not a valid address')

      expect(function () {
        new Zora(
          wallet,
          4,
          '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401',
          'not a valid ethereum address'
        )
      }).toThrow('Invariant failed: not a valid ethereum address is not a valid address')
    })

    it('throws an error if the chainId does not map to a network with deployed instance of the Zora Protocol', () => {
      const wallet = Wallet.createRandom()

      expect(function () {
        new Zora(wallet, 50)
      }).toThrow(
        'Invariant failed: chainId 50 not officially supported by the Zora Protocol'
      )
    })

    it('throws an error if the chainId does not map to a network with deployed instance of the Zora Protocol', () => {
      const wallet = Wallet.createRandom()

      expect(function () {
        new Zora(
          wallet,
          50,
          '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401',
          '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48'
        )
      }).not.toThrow(
        'Invariant failed: chainId 50 not officially supported by the Zora Protocol'
      )
    })

    it('sets the Zora instance to readOnly = false if a signer is specified', () => {
      const wallet = Wallet.createRandom()

      const zora = new Zora(
        wallet,
        50,
        '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401',
        '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48'
      )
      expect(zora.readOnly).toBe(false)
    })

    it('sets the Zora instance to readOnly = true if a signer is specified', () => {
      const provider = new JsonRpcProvider()

      const zora = new Zora(
        provider,
        50,
        '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401',
        '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48'
      )
      expect(zora.readOnly).toBe(true)
    })

    it('initializes a Zora instance with the checksummed media and market address for the specified chainId', () => {
      const wallet = Wallet.createRandom()
      const rinkebyMediaAddress = ZoraAddresses['rinkeby'].media
      const rinkebyMarketAddress = ZoraAddresses['rinkeby'].market
      const zora = new Zora(wallet, 4)
      expect(zora.marketAddress).toBe(rinkebyMarketAddress)
      expect(zora.mediaAddress).toBe(rinkebyMediaAddress)
      expect(zora.market.address).toBe(rinkebyMarketAddress)
      expect(zora.media.address).toBe(rinkebyMediaAddress)
    })

    it('initializes a Zora instance with the specified media and market address if they are passed in', () => {
      const wallet = Wallet.createRandom()
      const mediaAddress = '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401'
      const marketAddress = '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48'

      const zora = new Zora(wallet, 50, mediaAddress, marketAddress)
      expect(zora.readOnly).toBe(false)
      expect(zora.marketAddress).toBe(marketAddress)
      expect(zora.mediaAddress).toBe(mediaAddress)
      expect(zora.market.address).toBe(marketAddress)
      expect(zora.media.address).toBe(mediaAddress)

      const zora1 = new Zora(wallet, 50, mediaAddress, marketAddress)
      expect(zora1.readOnly).toBe(false)
      expect(zora1.marketAddress).toBe(marketAddress)
      expect(zora1.mediaAddress).toBe(mediaAddress)
      expect(zora1.market.address).toBe(marketAddress)
      expect(zora1.media.address).toBe(mediaAddress)
    })
  })

  describe('contract functions', () => {
    let zoraConfig: ZoraConfiguredAddresses
    let provider = new JsonRpcProvider()
    let [mainWallet, otherWallet] = generatedWallets(provider)
    //let mainWallet = generatedWallets(provider)[0]

    beforeEach(async () => {
      await blockchain.resetAsync()
      zoraConfig = await setupZora(mainWallet, [otherWallet])
    })

    /******************
     * Write Functions
     ******************
     */

    describe('Write Functions', () => {
      let contentHash: string
      // @ts-ignore
      let contentHashBytes: Bytes
      let metadataHash: string
      // @ts-ignore
      let metadataHashBytes: Bytes
      let metadata: any
      let minifiedMetadata: string

      let defaultMediaData: MediaData
      let defaultBidShares: BidShares
      let defaultAsk: Ask
      // @ts-ignore
      let defaultBid: Bid
      // @ts-ignore
      let eipSig: EIP712Signature
      let defaultSupplyLimit: BigNumberish

      beforeEach(() => {
        metadata = {
          version: 'zora-20210101',
          name: 'blah blah',
          description: 'blah blah blah',
          mimeType: 'text/plain',
        }
        minifiedMetadata = generateMetadata(metadata.version, metadata)
        metadataHash = sha256FromBuffer(Buffer.from(minifiedMetadata))
        contentHash = sha256FromBuffer(Buffer.from('invert'))

        defaultMediaData = constructMediaData(
          'https://example.com',
          'https://metadata.com',
          contentHash,
          metadataHash
        )
        defaultBidShares = constructBidShares(10, 90, 0)
        defaultAsk = constructAsk(zoraConfig.currency, Decimal.new(100).value)
        defaultBid = constructBid(
          zoraConfig.currency,
          Decimal.new(99).value,
          otherWallet.address,
          otherWallet.address,
          10
        )

        eipSig = {
          deadline: 1000,
          v: 0,
          r: '0x00',
          s: '0x00',
        }

        defaultSupplyLimit = BigNumber.from('3')
      })

      describe('#addItem', () => {
        it('在庫数は 999999 以下でなくてはならない', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await expect(
            zora.addItem(defaultMediaData.contentHash, maxSupplyLimit.add(1))
          ).rejects.toBe('Invariant failed: supplyLimit is invalid')
        })

        it('在庫数0は無効', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await expect(zora.addItem(defaultMediaData.contentHash, 0)).rejects.toBe(
            'Invariant failed: supplyLimit is invalid'
          )
        })

        it('アイテムIDを登録できる', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await zora.addItem(defaultMediaData.contentHash, maxSupplyLimit)
          // 在庫数が supplyLimitForEachItemId ( itemID ⇒ 在庫数 ) に mapping されている
          const itemSales = await zora.itemIdToItemSales(1) //typechain の FreeemaMedia からimportしていたけどうごくかなぁ t!
          await expect(itemSales.supplyLimit.eq(maxSupplyLimit))
        })

        it('別の contentHash の登録ができる', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await zora.addItem(defaultMediaData.contentHash, 1)
          await zora.addItem(sha256FromBuffer(Buffer.from('invert2')), 2)

          // 在庫数が supplyLimitForEachItemId ( itemID ⇒ 在庫数 ) に mapping されている
          const itemSales1 = await zora.itemIdToItemSales(1)
          const itemSales2 = await zora.itemIdToItemSales(2)
          await expect(itemSales1.supplyLimit.eq(BigNumber.from('1')))
          await expect(itemSales2.supplyLimit.eq(BigNumber.from('2'))) //t! 連番じゃないとそもそも動かない
          //全部通ってる
        })
      })

      describe('#addItemSale', () => {
        it('実行できる', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await zora.addItemSale(
            defaultMediaData,
            defaultBidShares,
            defaultAsk,
            defaultSupplyLimit
          )
          //addItemされている
          const itemSales = await zora.itemIdToItemSales(1)
          await expect(itemSales.supplyLimit.eq(defaultSupplyLimit))
          await expect(itemSales.onSale).toEqual(true) //false になっているらしい
          //tokenがmintされている
          const t = await zora.fetchMediaByIndex(0)
          expect(t.toNumber()).toEqual(tokenIdFirst.toNumber())
          //askが設定されている
          const ask = await zora.fetchCurrentAsk(tokenIdFirst)
          expect(ask.amount).toEqual(defaultAsk.amount)
        })
      })

      describe('#addItemSaleWithSig', () => {
        it('実行できる', async () => {
          const otherZora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 // 24 hours
          const domain = otherZora.eip712Domain()
          const nonce = await otherZora.fetchMintWithSigNonce(mainWallet.address)
          const eipSig = await signMintWithSigMessage(
            mainWallet,
            contentHash,
            metadataHash,
            Decimal.new(10).value,
            nonce.toNumber(),
            deadline,
            domain
          )
          const beforeNonce = await otherZora.fetchMintWithSigNonce(mainWallet.address)

          await otherZora.addItemSaleWithSig(
            mainWallet.address,
            defaultMediaData,
            defaultBidShares,
            defaultAsk,
            defaultSupplyLimit,
            eipSig
          )

          const recovered = await otherZora.fetchCreator(tokenIdFirst)
          const recoveredTokenURI = await otherZora.fetchContentURI(tokenIdFirst)
          const recoveredMetadataURI = await otherZora.fetchMetadataURI(tokenIdFirst)
          const recoveredContentHash = await otherZora.fetchContentHash(tokenIdFirst)
          const recoveredMetadataHash = await otherZora.fetchMetadataHash(tokenIdFirst)
          const recoveredCreatorBidShare = formatUnits(
            (await otherZora.fetchCurrentBidShares(tokenIdFirst)).creator.value,
            'ether'
          )
          const afterNonce = await otherZora.fetchMintWithSigNonce(mainWallet.address)
          expect(recovered).toEqual(mainWallet.address)
          expect(recoveredTokenURI).toEqual(defaultMediaData.tokenURI)
          expect(recoveredMetadataURI).toEqual(defaultMediaData.metadataURI)
          expect(recoveredContentHash).toEqual(contentHash)
          expect(recoveredMetadataHash).toEqual(metadataHash)
          expect(recoveredCreatorBidShare).toEqual('10.0')
          expect(afterNonce).toEqual(beforeNonce.add(1))
        })
      })

      describe('#updateContentURI', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.updateContentURI(0, 'new uri')).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('throws an error if the tokenURI does not begin with `https://`', async () => {
          const zora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await zora.mint(defaultMediaData, defaultBidShares)
          await expect(
            zora.updateContentURI(tokenIdFirst, 'http://example.com')
          ).rejects.toBe(
            'Invariant failed: http://example.com must begin with `https://`'
          )
        })

        it('updates the content uri', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)

          const tokenURI = await mainZora.fetchContentURI(tokenIdFirst)
          expect(tokenURI).toEqual(defaultMediaData.tokenURI)

          await mainZora.updateContentURI(tokenIdFirst, 'https://newURI.com')

          const newTokenURI = await mainZora.fetchContentURI(tokenIdFirst)
          expect(newTokenURI).toEqual('https://newURI.com')
        })
      })

      describe('#updateMetadataURI', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.updateMetadataURI(tokenIdFirst, 'new uri')).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('throws an error if the metadataURI does not begin with `https://`', async () => {
          const zora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await zora.mint(defaultMediaData, defaultBidShares)
          await expect(
            zora.updateMetadataURI(tokenIdFirst, 'http://example.com')
          ).rejects.toBe(
            'Invariant failed: http://example.com must begin with `https://`'
          )
        })

        it('updates the metadata uri', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)

          const metadataURI = await mainZora.fetchMetadataURI(tokenIdFirst)
          expect(metadataURI).toEqual(defaultMediaData.metadataURI)

          await mainZora.updateMetadataURI(tokenIdFirst, 'https://newMetadataURI.com')

          const newMetadataURI = await mainZora.fetchMetadataURI(tokenIdFirst)
          expect(newMetadataURI).toEqual('https://newMetadataURI.com')
        })
      })

      describe('#mint', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.mint(defaultMediaData, defaultBidShares)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('throws an error if bid shares do not sum to 100', async () => {
          const zora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          const invalidBidShares = {
            prevOwner: Decimal.new(10),
            owner: Decimal.new(70),
            creator: Decimal.new(10),
          }
          expect(zora.readOnly).toBe(false)

          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await expect(zora.mint(defaultMediaData, invalidBidShares)).rejects.toBe(
            'Invariant failed: The BidShares sum to 90000000000000000000, but they must sum to 100000000000000000000'
          )
        })

        it('throws an error if the tokenURI does not begin with `https://`', async () => {
          const zora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          const invalidMediaData = {
            tokenURI: 'http://example.com',
            metadataURI: 'https://metadata.com',
            contentHash: contentHashBytes,
            metadataHash: metadataHashBytes,
          }
          expect(zora.readOnly).toBe(false)

          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await expect(zora.mint(invalidMediaData, defaultBidShares)).rejects.toBe(
            'Invariant failed: http://example.com must begin with `https://`'
          )
        })

        it('throws an error if the metadataURI does not begin with `https://`', async () => {
          const zora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          const invalidMediaData = {
            tokenURI: 'https://example.com',
            metadataURI: 'http://metadata.com',
            contentHash: contentHashBytes,
            metadataHash: metadataHashBytes,
          }
          expect(zora.readOnly).toBe(false)

          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await expect(zora.mint(invalidMediaData, defaultBidShares)).rejects.toBe(
            'Invariant failed: http://metadata.com must begin with `https://`'
          )
        })

        it('pads the gas limit by 10%', async () => {
          const otherZoraConfig = await setupZora(otherWallet, [mainWallet])
          const zoraMedia = FreeemaMediaFactory.connect(zoraConfig.media, mainWallet)
          await zoraMedia.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          const tx = await zoraMedia.mint(defaultMediaData, defaultBidShares)
          const otherZora = new Zora(
            otherWallet,
            50,
            otherZoraConfig.media,
            otherZoraConfig.market
          )
          await otherZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          const paddedTx = await otherZora.mint(defaultMediaData, defaultBidShares)

          expect(paddedTx.gasLimit).toEqual(tx.gasLimit.mul(110).div(100))
        })

        it('creates a new piece of media', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          const totalSupply = await mainZora.fetchTotalMedia()
          expect(totalSupply.toNumber()).toEqual(0)

          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)

          const owner = await mainZora.fetchOwnerOf(tokenIdFirst)
          const creator = await mainZora.fetchCreator(tokenIdFirst)
          const onChainContentHash = await mainZora.fetchContentHash(tokenIdFirst)
          const onChainMetadataHash = await mainZora.fetchMetadataHash(tokenIdFirst)

          const onChainBidShares = await mainZora.fetchCurrentBidShares(tokenIdFirst)
          const onChainContentURI = await mainZora.fetchContentURI(tokenIdFirst)
          const onChainMetadataURI = await mainZora.fetchMetadataURI(tokenIdFirst)

          expect(owner.toLowerCase()).toBe(mainWallet.address.toLowerCase())
          expect(creator.toLowerCase()).toBe(mainWallet.address.toLowerCase())
          expect(onChainContentHash).toBe(contentHash)
          expect(onChainContentURI).toBe(defaultMediaData.tokenURI)
          expect(onChainMetadataURI).toBe(defaultMediaData.metadataURI)
          expect(onChainMetadataHash).toBe(metadataHash)
          expect(onChainBidShares.creator.value).toEqual(defaultBidShares.creator.value)
          expect(onChainBidShares.owner.value).toEqual(defaultBidShares.owner.value)
          expect(onChainBidShares.prevOwner.value).toEqual(
            defaultBidShares.prevOwner.value
          )
        })
      })

      describe('#mintWithSig', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(
            zora.mintWithSig(
              otherWallet.address,
              defaultMediaData,
              defaultBidShares,
              eipSig
            )
          ).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('throws an error if bid shares do not sum to 100', async () => {
          const zora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          const invalidBidShares = {
            prevOwner: Decimal.new(10),
            owner: Decimal.new(70),
            creator: Decimal.new(10),
          }
          expect(zora.readOnly).toBe(false)

          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await expect(
            zora.mintWithSig(
              otherWallet.address,
              defaultMediaData,
              invalidBidShares,
              eipSig
            )
          ).rejects.toBe(
            'Invariant failed: The BidShares sum to 90000000000000000000, but they must sum to 100000000000000000000'
          )
        })

        it('throws an error if the tokenURI does not begin with `https://`', async () => {
          const zora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          const invalidMediaData = {
            tokenURI: 'http://example.com',
            metadataURI: 'https://metadata.com',
            contentHash: contentHashBytes,
            metadataHash: metadataHashBytes,
          }
          expect(zora.readOnly).toBe(false)

          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await expect(
            zora.mintWithSig(
              otherWallet.address,
              invalidMediaData,
              defaultBidShares,
              eipSig
            )
          ).rejects.toBe(
            'Invariant failed: http://example.com must begin with `https://`'
          )
        })

        it('throws an error if the metadataURI does not begin with `https://`', async () => {
          const zora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          const invalidMediaData = {
            tokenURI: 'https://example.com',
            metadataURI: 'http://metadata.com',
            contentHash: contentHashBytes,
            metadataHash: metadataHashBytes,
          }
          expect(zora.readOnly).toBe(false)

          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await expect(zora.mint(invalidMediaData, defaultBidShares)).rejects.toBe(
            'Invariant failed: http://metadata.com must begin with `https://`'
          )
        })

        it('creates a new piece of media', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          const otherZora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 // 24 hours
          const domain = otherZora.eip712Domain()
          const nonce = await otherZora.fetchMintWithSigNonce(mainWallet.address)
          const eipSig = await signMintWithSigMessage(
            mainWallet,
            contentHash,
            metadataHash,
            Decimal.new(10).value,
            nonce.toNumber(),
            deadline,
            domain
          )

          const totalSupply = await otherZora.fetchTotalMedia()
          expect(totalSupply.toNumber()).toEqual(0)

          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await otherZora.mintWithSig(
            mainWallet.address,
            defaultMediaData,
            defaultBidShares,
            eipSig
          )

          const owner = await otherZora.fetchOwnerOf(tokenIdFirst)
          const creator = await otherZora.fetchCreator(tokenIdFirst)
          const onChainContentHash = await otherZora.fetchContentHash(tokenIdFirst)
          const onChainMetadataHash = await otherZora.fetchMetadataHash(tokenIdFirst)

          const onChainBidShares = await otherZora.fetchCurrentBidShares(tokenIdFirst)
          const onChainContentURI = await otherZora.fetchContentURI(tokenIdFirst)
          const onChainMetadataURI = await otherZora.fetchMetadataURI(tokenIdFirst)

          expect(owner.toLowerCase()).toBe(mainWallet.address.toLowerCase())
          expect(creator.toLowerCase()).toBe(mainWallet.address.toLowerCase())
          expect(onChainContentHash).toBe(contentHash)
          expect(onChainContentURI).toBe(defaultMediaData.tokenURI)
          expect(onChainMetadataURI).toBe(defaultMediaData.metadataURI)
          expect(onChainMetadataHash).toBe(metadataHash)
          expect(onChainBidShares.creator.value).toEqual(defaultBidShares.creator.value)
          expect(onChainBidShares.owner.value).toEqual(defaultBidShares.owner.value)
          expect(onChainBidShares.prevOwner.value).toEqual(
            defaultBidShares.prevOwner.value
          )
        })
      })

      describe('#setAsk', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.setAsk(tokenIdFirst, defaultAsk)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('sets an ask for a piece of media', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)

          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)

          await mainZora.setAsk(tokenIdFirst, defaultAsk)

          const onChainAsk = await mainZora.fetchCurrentAsk(tokenIdFirst)
          expect(onChainAsk.currency.toLowerCase()).toEqual(
            defaultAsk.currency.toLowerCase()
          )
          expect(parseFloat(formatUnits(onChainAsk.amount, 'wei'))).toEqual(
            parseFloat(formatUnits(defaultAsk.amount, 'wei'))
          )
        })
      })

      describe('#setBid', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.setBid(tokenIdFirst, defaultBid)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('creates a new bid on chain', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)

          const otherZora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          const nullOnChainBid = await otherZora.fetchCurrentBidForBidder(
            tokenIdFirst,
            otherWallet.address
          )

          expect(nullOnChainBid.currency).toEqual(AddressZero)

          await otherZora.setBid(tokenIdFirst, defaultBid)
          const onChainBid = await otherZora.fetchCurrentBidForBidder(
            tokenIdFirst,
            otherWallet.address
          )

          expect(parseFloat(formatUnits(onChainBid.amount, 'wei'))).toEqual(
            parseFloat(formatUnits(onChainBid.amount, 'wei'))
          )
          expect(onChainBid.currency.toLowerCase()).toEqual(
            defaultBid.currency.toLowerCase()
          )
          expect(onChainBid.bidder.toLowerCase()).toEqual(defaultBid.bidder.toLowerCase())
          expect(onChainBid.recipient.toLowerCase()).toEqual(
            defaultBid.recipient.toLowerCase()
          )
          expect(onChainBid.sellOnShare.value).toEqual(defaultBid.sellOnShare.value)
        })
      })

      describe('#removeAsk', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.removeAsk(tokenIdFirst)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('removes an ask', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)
          await mainZora.setAsk(tokenIdFirst, defaultAsk)

          const onChainAsk = await mainZora.fetchCurrentAsk(tokenIdFirst)
          expect(onChainAsk.currency.toLowerCase()).toEqual(
            defaultAsk.currency.toLowerCase()
          )

          await mainZora.removeAsk(tokenIdFirst)

          const nullOnChainAsk = await mainZora.fetchCurrentAsk(tokenIdFirst)
          expect(nullOnChainAsk.currency).toEqual(AddressZero)
        })
      })

      describe('#removeBid', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.removeBid(tokenIdFirst)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('removes a bid', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)
          const otherZora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          await otherZora.setBid(tokenIdFirst, defaultBid)
          const onChainBid = await otherZora.fetchCurrentBidForBidder(
            tokenIdFirst,
            otherWallet.address
          )

          expect(parseFloat(formatUnits(onChainBid.amount, 'wei'))).toEqual(
            parseFloat(formatUnits(onChainBid.amount, 'wei'))
          )
          expect(onChainBid.currency.toLowerCase()).toEqual(
            defaultBid.currency.toLowerCase()
          )
          expect(onChainBid.bidder.toLowerCase()).toEqual(defaultBid.bidder.toLowerCase())
          expect(onChainBid.recipient.toLowerCase()).toEqual(
            defaultBid.recipient.toLowerCase()
          )
          expect(onChainBid.sellOnShare.value).toEqual(defaultBid.sellOnShare.value)

          await otherZora.removeBid(tokenIdFirst)

          const nullOnChainBid = await otherZora.fetchCurrentBidForBidder(
            tokenIdFirst,
            otherWallet.address
          )

          expect(nullOnChainBid.currency).toEqual(AddressZero)
        })
      })

      describe('#acceptBid', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.acceptBid(tokenIdFirst, defaultBid)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('accepts a bid', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)
          const otherZora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          await otherZora.setBid(tokenIdFirst, defaultBid)
          await mainZora.acceptBid(tokenIdFirst, defaultBid)
          const newOwner = await otherZora.fetchOwnerOf(tokenIdFirst)
          expect(newOwner.toLowerCase()).toEqual(otherWallet.address.toLowerCase())
        })
      })

      describe('#permit', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(
            zora.permit(otherWallet.address, tokenIdFirst, eipSig)
          ).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('grants approval to a different address', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)
          const otherZora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)

          const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 // 24 hours
          const domain = mainZora.eip712Domain()
          const eipSig = await signPermitMessage(
            mainWallet,
            otherWallet.address,
            tokenIdFirst.toNumber(),
            0,
            deadline,
            domain
          )

          await otherZora.permit(otherWallet.address, tokenIdFirst, eipSig)
          const approved = await otherZora.fetchApproved(tokenIdFirst)
          expect(approved.toLowerCase()).toBe(otherWallet.address.toLowerCase())
        })
      })

      describe('#revokeApproval', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.revokeApproval(tokenIdFirst)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it("revokes an addresses approval of another address's media", async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)
          await mainZora.approve(otherWallet.address, tokenIdFirst)
          const approved = await mainZora.fetchApproved(tokenIdFirst)
          expect(approved.toLowerCase()).toBe(otherWallet.address.toLowerCase())

          const otherZora = new Zora(otherWallet, 50, zoraConfig.media, zoraConfig.market)
          await otherZora.revokeApproval(tokenIdFirst)
          const nullApproved = await mainZora.fetchApproved(tokenIdFirst)
          expect(nullApproved).toBe(AddressZero)
        })
      })

      describe('#burn', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.burn(tokenIdFirst)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('burns a piece of media', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)

          const owner = await mainZora.fetchOwnerOf(tokenIdFirst)
          expect(owner.toLowerCase()).toEqual(mainWallet.address.toLowerCase())

          const totalSupply = await mainZora.fetchTotalMedia()
          expect(totalSupply.toNumber()).toEqual(1)

          await mainZora.burn(tokenIdFirst)

          const zeroSupply = await mainZora.fetchTotalMedia()
          expect(zeroSupply.toNumber()).toEqual(0)
        })
      })

      describe('#approve', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.approve(otherWallet.address, tokenIdFirst)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('grants approval for another address for a piece of media', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)
          const nullApproved = await mainZora.fetchApproved(tokenIdFirst)
          expect(nullApproved).toBe(AddressZero)
          await mainZora.approve(otherWallet.address, tokenIdFirst)
          const approved = await mainZora.fetchApproved(tokenIdFirst)
          expect(approved.toLowerCase()).toBe(otherWallet.address.toLowerCase())
        })
      })

      describe('#setApprovalForAll', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(zora.setApprovalForAll(otherWallet.address, true)).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('sets approval for another address for all media owned by owner', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)
          const notApproved = await mainZora.fetchIsApprovedForAll(
            mainWallet.address,
            otherWallet.address
          )
          expect(notApproved).toBe(false)
          await mainZora.setApprovalForAll(otherWallet.address, true)
          const approved = await mainZora.fetchIsApprovedForAll(
            mainWallet.address,
            otherWallet.address
          )
          expect(approved).toBe(true)

          await mainZora.setApprovalForAll(otherWallet.address, false)
          const revoked = await mainZora.fetchIsApprovedForAll(
            mainWallet.address,
            otherWallet.address
          )
          expect(revoked).toBe(false)
        })
      })

      describe('#transferFrom', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(
            zora.transferFrom(mainWallet.address, otherWallet.address, tokenIdFirst)
          ).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })

        it('transfers media to another address', async () => {
          const mainZora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await mainZora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await mainZora.mint(defaultMediaData, defaultBidShares)
          const owner = await mainZora.fetchOwnerOf(tokenIdFirst)
          expect(owner.toLowerCase()).toEqual(mainWallet.address.toLowerCase())

          await mainZora.transferFrom(
            mainWallet.address,
            otherWallet.address,
            tokenIdFirst
          )
          const newOwner = await mainZora.fetchOwnerOf(tokenIdFirst)
          expect(newOwner.toLowerCase()).toEqual(otherWallet.address.toLowerCase())
        })
      })

      describe('#safeTransferFrom', () => {
        it('throws an error if called on a readOnly Zora instance', async () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          expect(zora.readOnly).toBe(true)

          await expect(
            zora.safeTransferFrom(mainWallet.address, otherWallet.address, tokenIdFirst)
          ).rejects.toBe(
            'ensureNotReadOnly: readOnly Zora instance cannot call contract methods that require a signer.'
          )
        })
      })

      describe('#eip712Domain', () => {
        it('returns chainId 1 on a local blockchain', () => {
          const provider = new JsonRpcProvider()

          const zora = new Zora(provider, 50, zoraConfig.media, zoraConfig.market)
          const domain = zora.eip712Domain()
          expect(domain.chainId).toEqual(1)
          expect(domain.verifyingContract.toLowerCase()).toEqual(
            zora.mediaAddress.toLowerCase()
          )
        })

        it('returns the zora chainId', () => {
          const provider = new JsonRpcProvider()
          const zora = new Zora(provider, 4, zoraConfig.media, zoraConfig.market)
          const domain = zora.eip712Domain()

          expect(domain.chainId).toEqual(4)
          expect(domain.verifyingContract.toLowerCase()).toEqual(
            zora.mediaAddress.toLowerCase()
          )
        })
      })

      describe('#isValidBid', () => {
        it('returns true if the bid amount can be evenly split by current bidShares', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await zora.mint(defaultMediaData, defaultBidShares)
          const isValid = await zora.isValidBid(tokenIdFirst, defaultBid)
          expect(isValid).toEqual(true)
        })

        it('returns false if the bid amount cannot be evenly split by current bidShares', async () => {
          const cur = await deployCurrency(mainWallet, 'CUR', 'CUR', 2)
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          const bid = constructBid(
            cur,
            BigNumber.from(200),
            otherWallet.address,
            otherWallet.address,
            10
          )

          const preciseBidShares = {
            creator: Decimal.new(33.3333),
            owner: Decimal.new(33.3333),
            prevOwner: Decimal.new(33.3334),
          }

          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await zora.mint(defaultMediaData, preciseBidShares)
          const isValid = await zora.isValidBid(tokenIdFirst, bid)
          expect(isValid).toEqual(false)
        })

        it('returns false if the sell on share is invalid', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await zora.mint(defaultMediaData, defaultBidShares)

          const bid = constructBid(
            zoraConfig.currency,
            BigNumber.from(200),
            otherWallet.address,
            otherWallet.address,
            90.1
          )

          const isValid = await zora.isValidBid(tokenIdFirst, bid)
          expect(isValid).toEqual(false)
        })
      })

      describe('#isValidAsk', () => {
        it('returns true if the ask amount can be evenly split by current bidShares', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await zora.mint(defaultMediaData, defaultBidShares)
          const isValid = await zora.isValidAsk(tokenIdFirst, defaultAsk)
          expect(isValid).toEqual(true)
        })

        it('returns false if the ask amount cannot be evenly split by current bidShares', async () => {
          const cur = await deployCurrency(mainWallet, 'CUR', 'CUR', 2)
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          const ask = constructAsk(cur, BigNumber.from(200))

          const preciseBidShares = {
            creator: Decimal.new(33.3333),
            owner: Decimal.new(33.3333),
            prevOwner: Decimal.new(33.3334),
          }

          await zora.addItem(defaultMediaData.contentHash, defaultSupplyLimit)
          await zora.mint(defaultMediaData, preciseBidShares)
          const isValid = await zora.isValidAsk(tokenIdFirst, ask)
          expect(isValid).toEqual(false)
        })
      })

      describe('#isVerifiedMedia', () => {
        it('returns true if the media is verified', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          const mock = new MockAdapter(axios)
          const helloWorldBuf = await fs.readFile('./fixtures/HelloWorld.txt')
          const helloWorldURI =
            'https://ipfs/io/ipfs/Qmf1rtki74jvYmGeqaaV51hzeiaa6DyWc98fzDiuPatzyy'
          const kanyeBuf = await fs.readFile('./fixtures/kanye.jpg')
          const kanyeURI =
            'https://ipfs.io/ipfs/QmRhK7o7gpjkkpubu9EvqDGJEgY1nQxSkP7XsMcaX7pZwV'

          mock.onGet(kanyeURI).reply(200, kanyeBuf)
          mock.onGet(helloWorldURI).reply(200, helloWorldBuf)

          const mediaData = constructMediaData(
            kanyeURI,
            helloWorldURI,
            sha256FromBuffer(kanyeBuf),
            sha256FromBuffer(helloWorldBuf)
          )
          await zora.addItem(sha256FromBuffer(kanyeBuf), defaultSupplyLimit)
          await zora.mint(mediaData, defaultBidShares)

          const verified = await zora.isVerifiedMedia(tokenIdFirst)
          expect(verified).toEqual(true)
        })

        it('returns false if the media is not verified', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          const mock = new MockAdapter(axios)
          const helloWorldBuf = await fs.readFile('./fixtures/HelloWorld.txt')
          const helloWorldURI =
            'https://ipfs/io/ipfs/Qmf1rtki74jvYmGeqaaV51hzeiaa6DyWc98fzDiuPatzyy'
          const kanyeBuf = await fs.readFile('./fixtures/kanye.jpg')
          const kanyeURI =
            'https://ipfs.io/ipfs/QmRhK7o7gpjkkpubu9EvqDGJEgY1nQxSkP7XsMcaX7pZwV'

          mock.onGet(kanyeURI).reply(200, kanyeBuf)
          mock.onGet(helloWorldURI).reply(200, kanyeBuf) // this will cause verification to fail!

          const mediaData = constructMediaData(
            kanyeURI,
            helloWorldURI,
            sha256FromBuffer(kanyeBuf),
            sha256FromBuffer(helloWorldBuf)
          )
          await zora.addItem(sha256FromBuffer(kanyeBuf), defaultSupplyLimit)
          await zora.mint(mediaData, defaultBidShares)

          const verified = await zora.isVerifiedMedia(tokenIdFirst)
          expect(verified).toEqual(false)
        })

        it('rejects the promise if the media does not exist', async () => {
          const zora = new Zora(mainWallet, 50, zoraConfig.media, zoraConfig.market)
          await expect(zora.isVerifiedMedia(tokenIdFirst)).rejects.toContain(
            'token with that id does not exist'
          )
        })
      })
    })
  })
})
