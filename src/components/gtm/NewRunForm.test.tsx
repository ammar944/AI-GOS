import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewRunForm } from "@/components/gtm/NewRunForm";

describe("NewRunForm", () => {
  it("shows an error for an invalid URL", async () => {
    const handleSubmit = vi.fn();

    render(<NewRunForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText("Company URL"), {
      target: { value: "airtable" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start run" }));

    expect(
      await screen.findByText("Enter a valid http or https URL.")
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("submits a valid URL", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(<NewRunForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText("Company URL"), {
      target: { value: "https://airtable.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start run" }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith("https://airtable.com/");
    });
  });

  it("disables submit while the submit handler is pending", async () => {
    const handleSubmit = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 10))
    );

    render(<NewRunForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText("Company URL"), {
      target: { value: "https://airtable.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start run" }));

    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
