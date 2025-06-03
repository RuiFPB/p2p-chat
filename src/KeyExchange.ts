export interface KeyExchangeInterface {
    initiator: boolean,
    ecdh: ArrayBuffer | string,
    mlkem: Uint8Array | string,
}

export class KeyExchange implements KeyExchangeInterface {
    initiator: boolean;
    mlkem: Uint8Array | string;
    ecdh: ArrayBuffer | string;

    constructor (initiator = false, mlkem: Uint8Array | string, ecdh: ArrayBuffer | string) {
        this.initiator = initiator;
        this.mlkem = mlkem;
        this.ecdh = ecdh;
    }

}