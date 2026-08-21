{
  description = "everything-fucked dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";

  outputs =
    { self, nixpkgs }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
      ];
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              deno
              nodejs_22
              pnpm
              dbmate
              postgresql_17
              libpq
              nixfmt-rfc-style
            ];

            env = {
              PGHOST = "localhost";
              PGPORT = "5432";
              PGUSER = "efk";
              PGPASSWORD = "efk";
              PGDATABASE = "everything_fucked";
              DATABASE_URL = "postgres://efk:efk@localhost:5432/everything_fucked?sslmode=disable";
            };

            shellHook = ''
              echo "--- everything-fucked dev shell ---"
              echo "deno:       $(deno --version | head -1)"
              echo "node:       $(node --version)"
              echo "pnpm:       $(pnpm --version)"
              echo "dbmate:     $(dbmate --version)"
              echo "postgresql: $(psql --version)"
              echo "---------------------------------"
            '';
          };
        }
      );
    };
}
