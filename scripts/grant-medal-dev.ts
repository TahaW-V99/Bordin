import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const phone = process.argv[2] ?? "09010558858";
  const medalSlug = process.argv[3] ?? "sheykarchee-silver";
  const reason = process.argv[4] ?? "تست توسعه";

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    throw new Error(`کاربر با شماره ${phone} یافت نشد. ابتدا در اپ لاگین کنید.`);
  }

  const medal = await prisma.medal.findUnique({ where: { slug: medalSlug } });
  if (!medal) {
    throw new Error(`مدال ${medalSlug} یافت نشد. npm run db:seed را اجرا کنید.`);
  }

  const existing = await prisma.userMedal.findFirst({
    where: { userId: user.id, medalId: medal.id },
  });
  if (existing) {
    console.log(`کاربر ${phone} از قبل مدال ${medalSlug} را دارد.`);
    return;
  }

  await prisma.userMedal.create({
    data: {
      userId: user.id,
      medalId: medal.id,
      earnedReason: reason,
    },
  });

  console.log(`مدال ${medalSlug} به ${phone} داده شد.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
