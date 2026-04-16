import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { type Wallet } from "@wallets/domain/wallet/wallet";
import {
  WALLET_REPOSITORY,
  type IWalletRepository,
} from "@wallets/port/wallet.repository";

@Injectable()
export class GetMyWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository,
  ) {}

  async execute(playerId: string): Promise<Wallet> {
    const normalizedPlayerId = playerId.trim();

    if (!normalizedPlayerId) {
      throw new InternalServerErrorException("Authenticated player id is missing");
    }

    const walletResult = await this.walletRepository.findByPlayerId(normalizedPlayerId);

    if (!walletResult.success) {
      throw new InternalServerErrorException(walletResult.error.message);
    }

    const wallet = walletResult.data;

    if (!wallet) {
      throw new NotFoundException(`Wallet for player ${normalizedPlayerId} was not found`);
    }

    return wallet;
  }
}
