import Link from "next/link";
import { FileX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SharedBlueprintNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <Card className="border-2">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileX2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Blueprint Not Found</h1>
                <p className="text-muted-foreground">
                  This shared blueprint link is invalid or has expired.
                </p>
              </div>
              <Button asChild>
                <Link href="/">Go to Homepage</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
