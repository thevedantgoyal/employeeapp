import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App error boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-destructive" />
              </div>
            </div>
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The app hit an error. Try refreshing or signing in again.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button asChild variant="default">
                <Link to="/auth">Go to sign in</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Refresh page
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
