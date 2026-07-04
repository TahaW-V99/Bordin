import { ChatRoomPage } from "@/features/chat/components/chat-room-page";

type Props = { params: Promise<{ teamId: string }> };

export default async function ChatTeamRoomRoute({ params }: Props) {
  const { teamId } = await params;
  return <ChatRoomPage slug={`team-${teamId}`} />;
}
