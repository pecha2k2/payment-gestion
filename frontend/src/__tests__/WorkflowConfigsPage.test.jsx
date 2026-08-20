import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import WorkflowConfigsPage from "../pages/WorkflowConfigsPage";

vi.mock("../api", () => ({
  api: {
    getWorkflowConfigs: vi.fn(),
  },
}));

describe("WorkflowConfigsPage", () => {
  beforeEach(() => {
    api.getWorkflowConfigs.mockResolvedValue([
      {
        id: 1,
        nombre: "Flujo dañado",
        descripcion: "",
        tipo_pago: "CON_FACTURA",
        es_default: false,
        flujo_json: '["demandante", invalid]',
        activo: true,
      },
    ]);
  });

  it("opens malformed persisted workflow JSON for safe correction", async () => {
    render(<WorkflowConfigsPage />);

    await screen.findByText("Flujo dañado");
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(
      screen.getByRole("heading", { name: "Editar Flujo" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/demandante/)).toHaveValue(
      '["demandante", invalid]',
    );
    expect(screen.getByText(/contiene JSON inválido/)).toBeInTheDocument();
  });
});
