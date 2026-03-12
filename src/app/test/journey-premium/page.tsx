import {
  JourneyPremiumPreview,
  type JourneyPremiumPreviewScene,
} from '@/components/journey/journey-premium-preview-scenes';

interface JourneyPremiumTestPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function isPreviewScene(value: string | undefined): value is JourneyPremiumPreviewScene {
  return value === 'welcome' || value === 'cards' || value === 'artifact' || value === 'chat';
}

export default async function JourneyPremiumTestPage({
  searchParams,
}: JourneyPremiumTestPageProps): Promise<React.JSX.Element> {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const sceneParam = resolvedSearchParams.scene;
  const sceneValue = Array.isArray(sceneParam) ? sceneParam[0] : sceneParam;
  const scene = isPreviewScene(sceneValue) ? sceneValue : 'welcome';

  return <JourneyPremiumPreview scene={scene} />;
}
