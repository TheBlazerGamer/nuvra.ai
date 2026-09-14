import { PrismaClient, NomePlano } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.plano.upsert({
    where: { nome: NomePlano.BASICO },
    update: {},
    create: {
      nome: NomePlano.BASICO,
      limiteCriativosMes: 5,
      limiteCampanhasMes: 5,
      precoMensalCentavos: 0,
      taxaImplantacaoCentavos: 0,
    },
  });

  await prisma.plano.upsert({
    where: { nome: NomePlano.ESSENCIAL },
    update: {},
    create: {
      nome: NomePlano.ESSENCIAL,
      limiteCriativosMes: 15,
      limiteCampanhasMes: 15,
      precoMensalCentavos: 0,
      taxaImplantacaoCentavos: 0,
    },
  });

  await prisma.plano.upsert({
    where: { nome: NomePlano.PRO },
    update: {},
    create: {
      nome: NomePlano.PRO,
      limiteCriativosMes: 40,
      limiteCampanhasMes: 40,
      precoMensalCentavos: 0,
      taxaImplantacaoCentavos: 0,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
