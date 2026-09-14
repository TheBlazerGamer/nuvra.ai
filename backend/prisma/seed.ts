import { PrismaClient, NomePlano } from '@prisma/client';
import bcrypt from 'bcrypt';

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

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminSenha = process.env.ADMIN_SENHA;

  if (adminEmail && adminSenha) {
    const senhaHash = await bcrypt.hash(adminSenha, 10);
    await prisma.funcionario.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        nome: process.env.ADMIN_NOME ?? 'Equipe Nuvra',
        email: adminEmail,
        senhaHash,
      },
    });
    console.log(`Funcionário admin garantido: ${adminEmail}`);
  } else {
    console.log('ADMIN_EMAIL/ADMIN_SENHA não definidos — pulando criação do admin inicial.');
  }
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
