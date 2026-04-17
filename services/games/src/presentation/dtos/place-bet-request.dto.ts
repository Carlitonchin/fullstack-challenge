import { ApiProperty } from "@nestjs/swagger";

export class PlaceBetRequestDto {
  @ApiProperty({
    example: "10.50",
    description: "Bet amount represented as a decimal string in BRL",
  })
  amount!: string;
}
