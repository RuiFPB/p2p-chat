export interface KeyExchangeInterface {
    initiator: boolean,
    ecdh: string,
    mlkem: string,
}

export class KeyExchange implements KeyExchangeInterface {
    initiator: boolean;
    mlkem: string;
    ecdh: string;

    constructor (initiator = false, mlkem: string, ecdh: string) {
        this.initiator = initiator;
        this.mlkem = mlkem;
        this.ecdh = ecdh;
    }

}