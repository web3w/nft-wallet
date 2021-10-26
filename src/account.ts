import {ContractSchemas} from './contracts/index'
import {
    Web3,
    ElementAPIConfig,
    ETHSending,
    ExchangeMetadata,
    Network
} from './types'

import {
    encodeParamsCall,
    encodeWeb3Call,
    getBalanceSchemas, LimitedCallSpec,
} from './schema'
import {BigNumber, MAX_UINT_256, NULL_ADDRESS} from './utils/constants'
import {AnnotatedFunctionABI} from "./schema/types";
import {makeBigNumber} from "./utils/helper";
import {PricePerToken} from "./contracts/config";
import {EventData} from "web3-eth-contract";

// 根据 DB签名过的订单 make一个对手单
export class Account extends ContractSchemas {
    // public ethApi: EthApi
    public buyAccount: string

    constructor(web3: Web3, apiConfig: ElementAPIConfig = {networkName: Network.Rinkeby}) {
        super(web3, apiConfig)
        this.buyAccount = apiConfig.account || web3.eth.defaultAccount?.toLowerCase() || ''
    }

    // 取消订单
    public async presaleBuy(sig: string): Promise<ETHSending> {
        const to = this.nftExchangeAddr
        // @ts-ignore
        const abi = this.NftExchangeFunc.presaleBuy({
            address: to,
            sig,

        })
        // const abi = {
        //     "inputs": [
        //         {
        //             "name": "sig",
        //             "type": "bytes",
        //             "value": sig
        //         }
        //     ],
        //     "name": "presaleBuy",
        //     "outputs": [],
        //     "stateMutability": "payable",
        //     "type": "function"
        // } as AnnotatedFunctionABI
        const data = encodeParamsCall({abi})
        const callData = {to, data}
        return this.ethSend(callData, this.buyAccount)
    }


    public async publicBuy(qty: string) {
        const to = this.nftExchangeAddr
        // @ts-ignore
        const accountApprove = this.NftExchangeFunc.publicBuy({
            address: to,
            qty
        })
        const data = encodeParamsCall({abi: accountApprove})
        const value = makeBigNumber(qty).times(PricePerToken).toString()
        const callData = {to, data, value}

        return this.ethSend(callData, this.buyAccount)
    }

    public async saleLive() {
        const to = this.nftExchangeAddr
        // @ts-ignore
        const accountApprove = {
            "inputs": [],
            "name": "saleLive",
            "outputs": [
                {
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        } as AnnotatedFunctionABI
        const data = encodeParamsCall({abi: accountApprove})
        const callData = {to, data}
        return this.ethCall(callData, accountApprove.outputs)
    }

    public async presaleLive() {
        const to = this.nftExchangeAddr
        // @ts-ignore
        const accountApprove = {
            "inputs": [],
            "name": "presaleLive",
            "outputs": [
                {
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        } as AnnotatedFunctionABI
        const data = encodeParamsCall({abi: accountApprove})
        const callData = {to, data}
        return this.ethCall(callData, accountApprove.outputs)
    }

    public async pricePerToken() {
        const to = this.nftExchangeAddr
        // @ts-ignore
        const abi = {
            "inputs": [],
            "name": "pricePerToken",
            "outputs": [
                {
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        } as AnnotatedFunctionABI
        const data = encodeParamsCall({abi})
        const callData = {to, data}
        return this.ethCall(callData, abi.outputs)
    }

    public async changePrice() {
        const to = this.nftExchangeAddr
        // @ts-ignore
        const abi = {
            "inputs": [
                {
                    "name": "newPrice",
                    "type": "uint256",
                    "value": "20000"
                }
            ],
            "name": "changePrice",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        } as AnnotatedFunctionABI
        const data = encodeParamsCall({abi})
        const callData = {to, data}
        return this.ethSend(callData, this.buyAccount)
    }


    public async withdrawEarnings() {
        const to = this.nftExchangeAddr
        // @ts-ignore
        const abi = {
            "inputs": [],
            "name": "withdrawEarnings",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        } as AnnotatedFunctionABI
        const data = encodeParamsCall({abi})
        const callData = {to, data} as LimitedCallSpec
        return this.ethSend(callData, this.buyAccount)
    }

    public async getMintInfoEvents(): Promise<EventData[]> {
        const event = this.NftExchangeEvent.transfer
        const transferContract = new this.web3.eth.Contract(event, this.nftExchangeAddr)
        const fromBlock = 9527340
        const toBlock = 'latest'
        // filter: {from: ['0x53edE7caE3eB6a7D11429Fe589c0278C9acBE21A']},
        return await transferContract.getPastEvents(event[0].name, {
            fromBlock,
            toBlock
        })

    }

    public async getAccountBalance(account?: string, tokenAddr?: string): Promise<{ ethBal: string; erc20Bal: string }> {
        const owner = account || this.buyAccount
        const ethBal: string = await this.web3.eth.getBalance(owner, 'latest')
        let erc20Bal = '0'
        if (tokenAddr && tokenAddr !== NULL_ADDRESS) {
            erc20Bal = await this.getTokenBalances(tokenAddr, owner)
        }
        return {ethBal, erc20Bal}
    }

    public async getTokenBalances(to: string, account?: string): Promise<string> {
        const owner = account || this.buyAccount
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const accountBal = this.Erc20Func.countOf({address: to})
        const data = encodeParamsCall({abi: accountBal, owner})
        const callData = {to, data}
        return this.ethCall(callData, accountBal?.outputs)
    }

    public async getAssetBalances(metadata: ExchangeMetadata, account?: string): Promise<string> {
        const owner = account || this.buyAccount
        const accountBal = getBalanceSchemas(metadata)
        const data = encodeParamsCall({abi: accountBal, owner})
        const callData = {to: accountBal.target, data} as LimitedCallSpec
        const bal = await this.ethCall(callData, accountBal?.outputs)
        if (accountBal?.outputs[0].type === 'address') {
            return bal.toLowerCase() === owner.toLowerCase() ? '1' : '0'
        } else {
            return bal
        }
    }
}