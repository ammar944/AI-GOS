import {
  JourneyManusPreview,
  type JourneyManusPreviewScene,
} from '@/components/journey/journey-manus-preview-scenes';

interface JourneyManusTestPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function isPreviewScene(value: string | undefined): value is JourneyManusPreviewScene {
  return value === 'welcome' || value === 'prefill' || value === 'review' || value === 'chat';
}

export default async function JourneyManusTestPage({
  searchParams,
}: JourneyManusTestPageProps): Promise<React.JSX.Element> {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const sceneParam = resolvedSearchParams.scene;
  const controlsParam = resolvedSearchParams.controls;
  const sceneValue = Array.isArray(sceneParam) ? sceneParam[0] : sceneParam;
  const controlsValue = Array.isArray(controlsParam) ? controlsParam[0] : controlsParam;
  const scene = isPreviewScene(sceneValue) ? sceneValue : 'welcome';
  const showSceneSwitcher = controlsValue !== '0';

  return <JourneyManusPreview scene={scene} showSceneSwitcher={showSceneSwitcher} />;
}
